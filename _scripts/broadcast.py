#!/usr/bin/env python3
"""Trasmette articoli del blog sui canali social tramite Buffer, usando GitHub Models per i copy
e Cloudinary per i ritagli delle immagini.

Uso:
  python3 _scripts/broadcast.py [--dry-run] [--posts post1.md post2.md ...]
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
SITE_URL = "https://gabrielebaldassarre.com"
BUFFER_API_TOKEN = os.environ.get("BUFFER_API_TOKEN", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# GitHub Models API
MODELS_URL = "https://models.github.ai/inference/chat/completions"

# Buffer GraphQL API
BUFFER_GRAPHQL_URL = "https://api.buffer.com/graphql"

# Social image crop sizes AND character limits per channel
SOCIAL_CROPS = {
    "linkedin": {
        "width": 1200,
        "height": 627,
        "transforms": "w_1200,h_627,c_fill,g_auto,q_auto,f_auto",
        "max_chars": 800
    },
    "mastodon": {
        "width": 1200,
        "height": 675,
        "transforms": "w_1200,h_675,c_fill,g_auto,q_auto,f_auto",
        "max_chars": 390
    },
    "bluesky": {
        "width": 1200,
        "height": 675,
        "transforms": "w_1200,h_675,c_fill,g_auto,q_auto,f_auto",
        "max_chars": 300
    },
    "youtube": {
        "width": 1280,
        "height": 720,
        "transforms": "w_1280,h_720,c_fill,g_auto,q_auto,f_auto",
        "max_chars": 5000
    }
}

# Default channels to broadcast when no explicit list is in frontmatter
DEFAULT_CHANNELS = ["linkedin", "mastodon"]

SOCIAL_COPY_PROMPT = """Sei un ingegnere italiano che scrive di fisica, automazione e data science su un blog personale. Non sei un social media manager.

IL TUO CARATTERE:
- Spieghi cose complesse con pazienza, senza annoiare. Il lettore è intelligente, non gli nascondi la difficoltà.
- Sei onesto: se qualcosa è approssimato lo dici, senza girarci intorno.
- Non ti prendi troppo sul serio. Un po' di autoironia ogni tanto ci sta.
- Scrivi in italiano colloquiale, come parli. Niente inglesismi inutili.
- Sei appassionato di quello che racconti, e si vede.

LINKEDIN (max 800 caratteri, URL escluso):
- Apertura: domanda in bold Unicode che stuzzica. Esempio:
  "𝙀̀ 𝙥𝙤𝙨𝙨𝙞𝙗𝙞𝙡𝙚 𝙨𝙚𝙜𝙢𝙚𝙣𝙩𝙖𝙧𝙚 𝙞𝙡 𝙥𝙧𝙤𝙥𝙧𝙞𝙤 𝙙𝙖𝙩𝙖𝙗𝙖𝙨𝙚 𝙞𝙣 𝙗𝙖𝙨𝙚 𝙖𝙡𝙡𝙖 𝙨𝙚𝙣𝙨𝙞𝙗𝙞𝙡𝙞𝙩𝙖̀ 𝙙𝙚𝙞 𝙘𝙡𝙞𝙚𝙣𝙩𝙞?"
- Corpo: 2-3 paragrafi. Spiega di cosa parli, cosa hai scoperto, perché è interessante. Usa dettagli specifici dell'articolo.
- Hashtag inline nel testo: hashtag#parola (3-5 max). Esempio: "nel mondo del hashtag#databasemarketing..."
- Chiusura: domanda al lettore in bold Unicode. Esempio: "𝙀 𝙫𝙤𝙞? 𝘾𝙤𝙨𝙖 𝙣𝙚 𝙥𝙚𝙣𝙨𝙖𝙩𝙚?"
- L'URL viene aggiunto dopo. Ignoralo.

MASTODON (max 390 caratteri, URL escluso):
- Apertura: prima persona, concreta. "Ho studiato...", "Mi sono chiesto..."
- 2-3 frasi. Asciutto, onesto. Un dettaglio specifico dall'articolo.
- 2-3 hashtag in fondo: #parola
- L'URL viene aggiunto dopo. Ignoralo.

Scrivi il testo su UNA RIGA SOLA (usa \\n per i paragrafi). Questo è critico per il formato JSON.

OUTPUT: JSON valido, niente testo prima o dopo.
{
  "linkedin": {
    "text": "Domanda in bold?\\n\\nCorpo del post con hashtag#inline...\\n\\nDomanda finale?",
    "hashtags": ["#parola1", "#parola2"]
  },
  "mastodon": {
    "text": "Frase diretta. Dettaglio concreto. Riflessione.",
    "hashtags": ["#parola1", "#parola2"]
  }
}"""


def parse_frontmatter(filepath):
    """Estrae il frontmatter YAML come dizionario e corpo da un file markdown."""
    with open(filepath) as f:
        content = f.read()

    match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
    if not match:
        raise ValueError(f"Nessun frontmatter trovato in {filepath}")

    fm_raw = match.group(1)
    body = match.group(2)

    import yaml
    fm = yaml.safe_load(fm_raw) or {}
    return fm, fm_raw, body, content


def update_file_frontmatter(filepath, fm, new_key, new_value):
    """Aggiunge una chiave `new_key: new_value` dentro il blocco `broadcast:` del frontmatter,
    preservando TUTTA la formattazione originale del resto del file."""
    with open(filepath) as f:
        content = f.read()

    start = content.index("---\n") + 4
    end = content.index("\n---\n", start + 4)
    before_fm = content[:start]
    fm_text = content[start:end]
    after_fm = content[end:]

    lines = fm_text.split("\n")
    new_lines = []
    in_broadcast = False
    broadcast_indent = 0
    broadcast_inserted = False

    for i, line in enumerate(lines):
        new_lines.append(line)

        stripped = line.strip()

        if re.match(r'^broadcast:', stripped):
            in_broadcast = True
            broadcast_indent = len(line) - len(line.lstrip())

        if in_broadcast:
            # Check next line: if it's at the same or lower indent level,
            # we're either at end of broadcast block or it's an empty broadcast
            next_line = lines[i + 1] if i + 1 < len(lines) else ""
            next_stripped = next_line.strip()
            next_indent = len(next_line) - len(next_line.lstrip()) if next_line.strip() else 999

            # End of broadcast block: next line is at same or outer indent level
            if next_indent <= broadcast_indent and next_stripped and not next_stripped.startswith("#"):
                # Check if sent: true already exists in this block
                block_lines = fm_text.split("\n")
                block_start = 0
                for j, bl in enumerate(block_lines):
                    if re.match(r'^broadcast:', bl.strip()):
                        block_start = j
                        break
                # Search forward to end of broadcast block
                block_end = len(block_lines)
                for j in range(block_start + 1, len(block_lines)):
                    bl_stripped = block_lines[j].strip()
                    bl_indent = len(block_lines[j]) - len(block_lines[j].lstrip()) if bl_stripped else 999
                    if bl_stripped and bl_indent <= broadcast_indent and not bl_stripped.startswith("#"):
                        block_end = j
                        break
                block_text = "\n".join(block_lines[block_start:block_end])
                if "sent:" not in block_text:
                    indent = " " * (broadcast_indent + 2)
                    new_lines.insert(len(new_lines), f"{indent}sent: true")
                in_broadcast = False
                broadcast_inserted = True

    # If broadcast block wasn't found or is a simple scalar, handle that
    if not broadcast_inserted:
        # Find broadcast: line
        for i, line in enumerate(new_lines):
            if re.match(r'^broadcast:', line.strip()):
                val = line.split(":", 1)[1].strip()
                if val in ("true", "false", ""):
                    # Replace scalar with mapping
                    indent = " " * (len(line) - len(line.lstrip()))
                    new_lines[i] = f"{indent}broadcast:"
                    new_lines.insert(i + 1, f"{indent}  sent: true")
                broadcast_inserted = True
                break

    # If broadcast key doesn't exist at all
    if not broadcast_inserted:
        new_lines.append("broadcast:")
        new_lines.append("  sent: true")

    new_fm = "\n".join(new_lines)
    new_content = f"{before_fm}{new_fm}{after_fm}"

    with open(filepath, "w") as f:
        f.write(new_content)


def get_broadcast_config(fm):
    """Estrae la configurazione broadcast dal dizionario frontmatter."""
    bc = fm.get("broadcast", None)

    if bc is None:
        return {"enabled": False, "channels": [], "sent": False}

    if bc is False:
        return {"enabled": False, "channels": [], "sent": False}

    if bc is True:
        return {"enabled": True, "channels": [], "sent": False}

    if isinstance(bc, list):
        return {"enabled": True, "channels": bc, "sent": False}

    if isinstance(bc, dict):
        sent = bc.get("sent", False)
        channels = bc.get("channels", [])
        if isinstance(channels, str):
            channels = [channels]
        return {"enabled": not sent, "channels": channels, "sent": sent}

    return {"enabled": False, "channels": [], "sent": False}


def get_master_image(fm):
    """Ottiene il percorso dell'immagine master dal frontmatter, con fallback a overlay_image."""
    master = fm.get("master")
    if master:
        return master

    header = fm.get("header", {})
    if isinstance(header, dict):
        overlay = header.get("overlay_image")
        if overlay:
            return overlay

    return None


def get_post_info(fm, body, filepath):
    """Estrae le informazioni rilevanti dal frontmatter e dal corpo per il prompt LLM."""
    title = fm.get("title", "")
    excerpt = fm.get("excerpt", "")
    category = fm.get("category", "")

    # Build URL from filepath
    slug = os.path.basename(filepath).replace(".md", "").replace(".Rmd", "")
    slug = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', slug)

    cat_dir = os.path.basename(os.path.dirname(filepath))
    post_url = f"{SITE_URL}/{cat_dir}/{slug}/"

    # First ~1500 chars of body, stripped of LaTeX and markdown
    clean_body = re.sub(r'\$\$.*?\$\$', '', body, flags=re.DOTALL)
    clean_body = re.sub(r'\$.*?\$', '', clean_body)
    clean_body = re.sub(r'!?\[.*?\]\(.*?\)', '', clean_body)
    clean_body = re.sub(r'[#*>_`~]', '', clean_body)
    clean_body = re.sub(r'\n{3,}', '\n\n', clean_body)
    clean_body = clean_body.strip()[:1500]

    return {
        "title": title,
        "excerpt": excerpt,
        "category": category,
        "url": post_url,
        "slug": slug,
        "body": clean_body
    }


def call_github_models(post_info, active_channels):
    """Call GitHub Models LLM to generate social copy for given channels.
    Tries gpt-4o first, falls back to gpt-4o-mini."""
    if not GITHUB_TOKEN:
        print("  ERRORE: GITHUB_TOKEN non impostato", file=sys.stderr)
        return None

    channel_list = ", ".join(active_channels)
    body_snippet = post_info.get("body", "")
    user_prompt = f"""Titolo: {post_info['title']}
Categoria: {post_info['category']}
URL: {post_info['url']}
Estratto: {post_info['excerpt']}

Contenuto dell'articolo (primi paragrafi):
{body_snippet}

Genera il copy per: {channel_list}"""

    for model in ["openai/gpt-4o", "openai/gpt-4o-mini"]:
        if model != "openai/gpt-4o":
            print(f"  Tentativo con modello fallback: {model}...")
        result = _call_models_api(model, user_prompt)
        if result:
            return result
    return None


def _call_models_api(model, user_prompt):
    """Single model API call to GitHub Models."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SOCIAL_COPY_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.7
    }

    req = urllib.request.Request(
        MODELS_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
    except Exception as e:
        print(f"  ERRORE chiamata GitHub Models ({model}): {e}", file=sys.stderr)
        return None

    try:
        result = json.loads(raw)
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        # Strip markdown code fences if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        # Try direct parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Fallback: fix unescaped newlines inside JSON strings
        def fix_json_newlines(s):
            in_string = False
            escaped = False
            result = []
            for ch in s:
                if escaped:
                    escaped = False
                    result.append(ch)
                elif ch == '\\':
                    escaped = True
                    result.append(ch)
                elif ch == '"':
                    in_string = not in_string
                    result.append(ch)
                elif ch == '\n' and in_string:
                    result.append('\\n')
                else:
                    result.append(ch)
            return ''.join(result)

        content = fix_json_newlines(content)
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        print(f"  ERRORE ({model}): LLM non ha prodotto JSON valido", file=sys.stderr)
        print(f"  Contenuto (primi 300 char): {content[:300]}", file=sys.stderr)
        return None
    except json.JSONDecodeError:
        print(f"  ERRORE ({model}): risposta API non-JSON", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ERRORE parsing risposta ({model}): {e}", file=sys.stderr)
        return None


def cloudinary_url(master_path, transforms):
    """Costruisce un URL Cloudinary fetch per una data immagine master e trasformazioni."""
    return (
        f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/image/fetch/"
        f"{transforms}/{SITE_URL}{master_path}"
    )


def buffer_graphql(query, variables=None):
    """Esegue una query GraphQL contro l'API Buffer."""
    if not BUFFER_API_TOKEN:
        print("  ERRORE: BUFFER_API_TOKEN non impostato", file=sys.stderr)
        return None

    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    req = urllib.request.Request(
        BUFFER_GRAPHQL_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {BUFFER_API_TOKEN}"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
    except Exception as e:
        print(f"  ERRORE chiamata GitHub Models: {e}", file=sys.stderr)
        return None

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print(f"  ERRORE: risposta non-JSON (primi 300 char): {raw[:300].decode(errors='replace')}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ERRORE chiamata API Buffer: {e}", file=sys.stderr)
        return None


def get_buffer_channels():
    """Interroga Buffer per i canali disponibili e restituisce una mappatura da nome servizio a ID canale."""
    # Step 1: Get organization ID
    org_query = """
    query {
      account {
        organizations {
          id
          name
        }
      }
    }
    """

    result = buffer_graphql(org_query)
    if not result:
        return {}

    orgs = result.get("data", {}).get("account", {}).get("organizations", [])
    if not orgs:
        print("  ERRORE: Nessuna organizzazione trovata nell'account Buffer", file=sys.stderr)
        return {}

    org_id = orgs[0]["id"]
    print(f"  Organizzazione: {orgs[0].get('name', 'N/A')} ({org_id})")

    # Step 2: Get channels for this organization
    ch_query = f"""
    query {{
      channels(input: {{ organizationId: "{org_id}" }}) {{
        id
        name
        service
      }}
    }}
    """

    ch_result = buffer_graphql(ch_query)
    if not ch_result:
        return {}

    channels = ch_result.get("data", {}).get("channels", [])
    channel_map = {}
    for ch in channels:
        service = ch.get("service", "").lower()
        ch_id = ch.get("id", "")
        if service and ch_id:
            channel_map[service] = ch_id
            print(f"  Canale: {ch.get('name', 'N/A')} ({service}) = {ch_id}")

    return channel_map


def gql_escape(s):
    """Esegue l'escape di una stringa per uso inline in una query GraphQL."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def warmup_cloudinary_url(url, label=""):
    """Scarica l'immagine da Cloudinary per forzare il caching completo. Ritenta fino a 5 volte."""
    for attempt in range(1, 6):
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read(1024)
                if len(data) > 0:
                    if attempt > 1:
                        print(f"    Cloudinary warmup OK ({label}, tentativo {attempt})")
                    return True
        except Exception as e:
            if attempt == 5:
                print(f"    Cloudinary warmup FALLITO ({label}): {e}", file=sys.stderr)
            else:
                time.sleep(2)
    return False


def create_buffer_draft(channel_id, text, photo_url=None, retries=3, label=""):
    """Crea una bozza in Buffer per un canale specifico. Ritenta se fallisce."""
    for attempt in range(1, retries + 1):
        if attempt > 1:
            print(f"  Tentativo {attempt}/{retries}...")
            time.sleep(2)

        # Warm up the Cloudinary URL before sending to Buffer
        if photo_url:
            warmup_cloudinary_url(photo_url, label)

        escaped_text = gql_escape(text)
        parts = [
            f'text: "{escaped_text}"',
            f'channelId: "{channel_id}"',
            'schedulingType: automatic',
            'mode: addToQueue',
            'saveToDraft: true'
        ]
        if photo_url:
            parts.append(f'assets: [{{ image: {{ url: "{gql_escape(photo_url)}" }} }}]')

        joined = ",\n        ".join(parts)

        query = f"""
        mutation {{
          createPost(input: {{
            {joined}
          }}) {{
            ... on PostActionSuccess {{
              post {{
                id
                text
              }}
            }}
            ... on MutationError {{
              message
            }}
          }}
        }}
        """

        result = buffer_graphql(query)
        if not result:
            continue

        data = result.get("data", {}).get("createPost", {})
        if "post" in data:
            return data["post"].get("id")

        msg = data.get("message", "Errore sconosciuto")
        if "Not Found" in msg or "image dimensions" in msg:
            print(f"  Errore Buffer (tentativo {attempt}): {msg} — attendo e ritento...", file=sys.stderr)
            continue
        else:
            print(f"  Errore Buffer: {msg}", file=sys.stderr)
            break

    # If all retries with image failed, try without image
    if photo_url:
        print("  Tentativo finale senza immagine...", file=sys.stderr)
        return create_buffer_draft(channel_id, text, photo_url=None, retries=1, label=label)
    return None

    data = result.get("data", {}).get("createPost", {})
    if "post" in data:
        post = data["post"]
        return post.get("id")
    else:
        msg = data.get("message", "Errore sconosciuto")
        print(f"  Errore Buffer: {msg}", file=sys.stderr)
        return None


def finalize_text(text, post_url):
    """Aggiunge l'URL dell'articolo al copy social."""
    return f"{text}\n\n{post_url}"


def broadcast_post(filepath, dry_run=False):
    """Trasmette un singolo articolo ai canali social configurati."""
    print(f"\n{'=' * 60}")
    print(f"Elaborazione: {filepath}")
    print(f"{'=' * 60}")

    try:
        fm, fm_raw, body, content = parse_frontmatter(filepath)
    except Exception as e:
        print(f"  SALTA: {e}")
        return False

    config = get_broadcast_config(fm)
    print(f"  Configurazione broadcast: abilitato={config['enabled']}, inviato={config['sent']}, canali={config['channels']}")

    if not config["enabled"]:
        print("  SALTA: broadcast non abilitato")
        return None

    if config["sent"]:
        print("  SALTA: già inviato")
        return None

    # Determine active channels
    active_channels = config["channels"] if config["channels"] else DEFAULT_CHANNELS

    print(f"  Canali attivi: {active_channels}")

    post_info = get_post_info(fm, body, filepath)
    master_image = get_master_image(fm)
    print(f"  Titolo: {post_info['title']}")
    print(f"  URL: {post_info['url']}")
    print(f"  Immagine master: {master_image or 'NESSUNA'}")

    if dry_run:
        print("  SIMULAZIONE - salto chiamate LLM e Buffer")
        return True

    # Step 1: Generate social copy via LLM
    print("  Generazione copy social via GitHub Models...")
    copy = call_github_models(post_info, active_channels)
    if not copy:
        print("  FALLITA generazione copy social")
        return False
    print("  Copy generato con successo")

    # Step 2: Resolve Buffer channels
    print("  Risoluzione canali Buffer...")
    channel_map = get_buffer_channels()
    if not channel_map:
        print("  FALLITA risoluzione canali Buffer")
        return False
    print(f"  Canali trovati: {list(channel_map.keys())}")

    # Step 3: Create drafts in Buffer
    created_count = 0
    target_count = 0
    for ch_type in active_channels:
        if ch_type not in channel_map:
            print(f"  ATTENZIONE: Canale '{ch_type}' non trovato in Buffer (disponibili: {list(channel_map.keys())})")
            continue

        if ch_type not in SOCIAL_CROPS:
            print(f"  ATTENZIONE: Nessuna configurazione di crop per il canale '{ch_type}'")
            continue

        ch_id = channel_map[ch_type]
        channel_copy = copy.get(ch_type, {})
        if isinstance(channel_copy, str):
            text = finalize_text(channel_copy, post_info["url"])
        elif isinstance(channel_copy, dict):
            text = channel_copy.get("text", "")
            text = finalize_text(text, post_info["url"])
            hashtags = channel_copy.get("hashtags", [])
            if hashtags:
                text += "\n\n" + " ".join(hashtags)
        else:
            print(f"  ATTENZIONE: Nessun copy generato per {ch_type}")
            continue

        # Enforce per-channel character limit
        max_chars = SOCIAL_CROPS[ch_type].get("max_chars", 0)
        if max_chars and len(text) > max_chars:
            print(f"  ATTENZIONE: Testo di {len(text)} caratteri supera il limite di {max_chars} — troncato")
            text = text[:max_chars].rsplit(" ", 1)[0]

        target_count += 1
        if ch_type == "linkedin":
            target_count += 1  # Secondo draft (link post nativo)

        # Build Cloudinary URL for the social crop
        transforms = SOCIAL_CROPS[ch_type]["transforms"]
        if master_image:
            photo_url = cloudinary_url(master_image, transforms)
        else:
            photo_url = None

        print(f"  Creazione draft per {ch_type} (canale: {ch_id})...")
        print(f"    Lunghezza testo: {len(text)} caratteri")
        if photo_url:
            print(f"    Immagine: {photo_url}")

        if ch_type == "linkedin":
            # LinkedIn: crea DUE draft — con immagine (come ora) + solo testo (link post nativo)
            draft_id_img = create_buffer_draft(ch_id, text, photo_url, label=ch_type)
            if draft_id_img:
                print(f"  ✅ Draft immagine creato: {draft_id_img}")
                created_count += 1
            else:
                print(f"  ❌ Fallita creazione draft immagine per {ch_type}")

            draft_id_link = create_buffer_draft(ch_id, text, photo_url=None, label=ch_type)
            if draft_id_link:
                print(f"  ✅ Draft link creato: {draft_id_link}")
                created_count += 1
            else:
                print(f"  ❌ Fallita creazione draft link per {ch_type}")
        else:
            draft_id = create_buffer_draft(ch_id, text, photo_url, label=ch_type)
            if draft_id:
                print(f"  ✅ Draft creato: {draft_id}")
                created_count += 1
            else:
                print(f"  ❌ Fallita creazione draft per {ch_type}")

    if created_count == 0:
        print("  FALLITO: Nessun draft creato")
        return False

    # Step 4: Mark as sent in frontmatter — only if ALL targeted channels succeeded
    if not dry_run:
        if created_count >= target_count:
            update_file_frontmatter(filepath, fm, "broadcast.sent", True)
            print(f"  Frontmatter aggiornato: broadcast.sent = true")
        else:
            print(f"  ATTENZIONE: {created_count}/{target_count} canali creati — broadcast.sent NON impostato")
            return False

    print(f"  Fatto: {created_count} draft creati")
    return True


def main():
    dry_run = "--dry-run" in sys.argv
    post_args = [a for a in sys.argv[1:] if a != "--dry-run" and a != "--posts"]

    # If --posts flag is present, collect following args
    if "--posts" in sys.argv:
        idx = sys.argv.index("--posts")
        post_args = sys.argv[idx + 1:]
    else:
        post_args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if not post_args:
        print("Uso: python3 _scripts/broadcast.py [--dry-run] [--posts] post1.md [post2.md ...]")
        sys.exit(1)

    results = {}
    all_ok = True
    for post_path in post_args:
        if not os.path.exists(post_path):
            print(f"ERRORE: File non trovato: {post_path}")
            all_ok = False
            continue
        result = broadcast_post(post_path, dry_run=dry_run)
        results[post_path] = result

    # Summary
    print(f"\n{'=' * 60}")
    print("RIEPILOGO")
    print(f"{'=' * 60}")
    for path, result in results.items():
        icon = "✅" if result else ("⏭️" if result is None else "❌")
        print(f"  {icon} {path}")

    if not all_ok or any(r is False for r in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
