#!/usr/bin/env python3
"""Broadcast blog posts to social channels via Buffer, using GitHub Models for copy
and Cloudinary for image crops.

Usage:
  python3 _scripts/broadcast.py [--dry-run] [--posts post1.md post2.md ...]
"""

import json
import os
import re
import sys
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

# Social image crop sizes per channel
SOCIAL_CROPS = {
    "linkedin": {
        "width": 1200,
        "height": 627,
        "transforms": "w_1200,h_627,c_fill,g_auto,q_auto,f_auto"
    },
    "mastodon": {
        "width": 1200,
        "height": 675,
        "transforms": "w_1200,h_675,c_fill,g_auto,q_auto,f_auto"
    },
    "bluesky": {
        "width": 1200,
        "height": 675,
        "transforms": "w_1200,h_675,c_fill,g_auto,q_auto,f_auto"
    },
    "youtube": {
        "width": 1280,
        "height": 720,
        "transforms": "w_1280,h_720,c_fill,g_auto,q_auto,f_auto"
    }
}

# Default channels to broadcast when no explicit list is in frontmatter
DEFAULT_CHANNELS = ["linkedin", "mastodon"]

SOCIAL_COPY_PROMPT = """Sei un ingegnere italiano che fa divulgazione scientifica. Il tuo blog si chiama "Pochi grassi e ingredienti rigorosamente POSIX standard". Scrivi copy per social media con la TUA voce autentica, non con quella di un social media manager.

LA TUA IDENTITÀ:
- Ingegnere, maker, divulgatore scientifico
- Scrivi di fisica quantistica, Home Assistant, reti sociali complesse, automation
- Costruisci cose da zero partendo dai primi principi, per il piacere di capire come funzionano
- Non ti prendi mai troppo sul serio, ma prendi MOLTO sul serio la matematica
- Sei onesto fino all'autocritica: se qualcosa è approssimato, lo dici. "Con qualche compromesso" è il tuo motto
- Usi un italiano colloquiale e idiomatico, mai tradotto dall'inglese. Scrivi come parli
- Vivi a Milano, hai dei bambini, compri dispositivi su AliExpress, programmi per rilassarti, e sei un po' nerd, da prima che andasse di moda
- Il tuo pubblico è intelligente e curioso: non gli nascondi la complessità, gliela spieghi con pazienza, perché la complessità è parte del divertimento e la cultura scientifica è un diritto di tutti
- L'italiano è una lingua fantastica, gli anglicismi li usi solo quando non c'è un modo più efficace di esprimere un concetto in italiano (e comunque li spieghi sempre)

IL TUO TONE OF VOICE — elementi distintivi che DEVI usare:
- "Molto banalmente..." per smontare un concetto complesso e renderlo accessibile
- "per capirci" come ponte colloquiale con il lettore
- "tanto per dire" come scrollata di spalle retorica
- "per non dire [X]" come understatement che in realtà intensifica
- "La risposta è sì, con qualche compromesso" — onestà pragmatica
- "Non è un'affermazione da fare alla leggera!" — enfasi severa ma affettuosa
- Domande retoriche che invitano alla complicità: "un classico, no?"
- Liste surreali per effetto comico (gattini, tostapane, manuali di D&D accanto a concetti scientifici)
- Ironia storica: la fisica è fatta da persone, con le loro contraddizioni (Einstein che odiava la quantistica ma ci vinse il Nobel)
- Autoironia: "non mi andava di comprarli", "una parola un po' altisonante per dire..."
- Parentesi ironiche: "(già... matematica)", "(approssimate a dir poco)", "(sto volutamente esagerando)"
- Maiuscole per enfatizzare distinzioni critiche, ma senza esagerare: "Attenzione! Questo NON significa che..."

REGOLE SPECIFICHE PER CANALE:

LINKEDIN (600-900 caratteri):
- Apertura: problema concreto o fatto controintuitivo che aggancia
- Usa la struttura "mito da sfatare": convinzione comune → perché è sbagliata → la vera spiegazione
- Includi UN dettaglio tecnico specifico (non per esibirti, ma per dimostrare che non stai annacquando)
- Usa il "noi" inclusivo ("Mettiamolo alla prova", "Partiamo da zero")
- Un accenno a una storia umana (Einstein, Pauli, i tuoi bambini) se pertinente
- Chiusura: riflessione o lezione pratica, con understatement
- Tono: semi-formale, autorevole ma caldo. Come spiegare fisica a un collega davanti a un caffè
- hashtag: 3-5, professionali e precisi

MASTODON (300-500 caratteri):
- Apertura: prima persona, diretta, personale. "Ho costruito...", "Non avevo...", "Mi sono chiesto..."
- Abbraccia l'autoironia e l'umorismo secco
- Usa liberamente le parentesi ironiche — suonano naturali su Mastodon
- Inserisci un dettaglio umano o concreto (la finestra del soggiorno, i LED di AliExpress, la costellazione Zigbee)
- Sii leggermente bastian contrario o scettico verso le narrative tech mainstream
- Tono: colloquiale, da persona vera in una community di pari
- hashtag: 2-3, più da community (#makerculture, #divulgazione, #HomeAssistant)

COSTANTI TRASVERSALI (entrambi i canali):
1. Se c'è un'approssimazione, dillo: "È un'approssimazione, ma sufficiente per questo scopo"
2. Includi sempre un dettaglio umano (storia, ironia, vita quotidiana)
3. Parti sempre dal concreto per arrivare all'astratto, mai il contrario
4. Non annacquare mai il contenuto tecnico per "semplificare"
5. Scrivi in italiano idiomatico, colloquiale, vivo. Non tradurre dall'inglese
6. Non usare [LINK] — l'URL viene aggiunto dopo. Non serve menzionarlo

OUTPUT: JSON valido, niente testo prima o dopo.
{
  "linkedin": {
    "text": "...",
    "hashtags": ["#Tag1", "#Tag2", "#Tag3"]
  },
  "mastodon": {
    "text": "...",
    "hashtags": ["#Tag1", "#Tag2"]
  }
}"""


def parse_frontmatter(filepath):
    """Extract YAML frontmatter as dict and body from a markdown file."""
    with open(filepath) as f:
        content = f.read()

    match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
    if not match:
        raise ValueError(f"No frontmatter found in {filepath}")

    fm_raw = match.group(1)
    body = match.group(2)

    import yaml
    fm = yaml.safe_load(fm_raw) or {}
    return fm, fm_raw, body, content


def update_file_frontmatter(filepath, fm, new_key, new_value):
    """Update YAML frontmatter by adding or updating a key, then write file."""
    with open(filepath) as f:
        content = f.read()

    # Replace the frontmatter block
    start = content.index("---\n") + 4
    end = content.index("\n---\n", start)

    fm_lines = content[start:end].split("\n")

    # Add new key-value to the mapping
    new_lines = []
    inserted = False
    in_broadcast = False
    indent = ""

    for line in fm_lines:
        new_lines.append(line)

        if re.match(r'^broadcast:', line):
            in_broadcast = True
            # Check if it's a scalar value (false/true) or mapping
            val = line.split(":", 1)[1].strip()
            if val == "true" or val == "false" or line.endswith("true") or line.endswith("false"):
                # Convert scalar to mapping
                pass  # handled by YAML lib approach instead

    # Use YAML to reserialize for correctness
    import yaml
    fm_dict = yaml.safe_load(content[start:end]) or {}

    if "broadcast" not in fm_dict or fm_dict["broadcast"] is False:
        fm_dict["broadcast"] = {}
    if fm_dict["broadcast"] is True:
        fm_dict["broadcast"] = {}
    if not isinstance(fm_dict["broadcast"], dict):
        fm_dict["broadcast"] = {"channels": fm_dict["broadcast"]}

    fm_dict["broadcast"]["sent"] = True

    new_fm = yaml.dump(fm_dict, default_flow_style=False, allow_unicode=True, sort_keys=False).strip()
    new_content = f"---\n{new_fm}\n---\n" + content[end + 5:]

    with open(filepath, "w") as f:
        f.write(new_content)


def get_broadcast_config(fm):
    """Extract broadcast configuration from frontmatter dict."""
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
    """Get the master image path from frontmatter, falling back to overlay_image."""
    master = fm.get("master")
    if master:
        return master

    header = fm.get("header", {})
    if isinstance(header, dict):
        overlay = header.get("overlay_image")
        if overlay:
            return overlay

    return None


def get_post_info(fm, filepath):
    """Extract relevant info from frontmatter for the LLM prompt."""
    title = fm.get("title", "")
    excerpt = fm.get("excerpt", "")
    category = fm.get("category", "")

    # Build URL from filepath
    # _posts/fisica/2019-10-28-stati-spin.md -> /fisica/stati-di-spin/
    slug = os.path.basename(filepath).replace(".md", "").replace(".Rmd", "")
    # Remove date prefix: YYYY-MM-DD-
    slug = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', slug)

    cat_dir = os.path.basename(os.path.dirname(filepath))
    post_url = f"{SITE_URL}/{cat_dir}/{slug}/"

    return {
        "title": title,
        "excerpt": excerpt,
        "category": category,
        "url": post_url,
        "slug": slug
    }


def call_github_models(post_info, active_channels):
    """Call GitHub Models LLM to generate social copy for given channels."""
    if not GITHUB_TOKEN:
        print("  ERROR: GITHUB_TOKEN not set", file=sys.stderr)
        return None

    channel_list = ", ".join(active_channels)
    user_prompt = f"""Titolo: {post_info['title']}
Categoria: {post_info['category']}
URL: {post_info['url']}
Estratto: {post_info['excerpt']}

Genera il copy per: {channel_list}"""

    payload = {
        "model": "openai/gpt-4o-mini",
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
            result = json.loads(resp.read())
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return json.loads(content)
    except Exception as e:
        print(f"  ERROR calling GitHub Models: {e}", file=sys.stderr)
        return None


def cloudinary_url(master_path, transforms):
    """Build a Cloudinary fetch URL for a given master image and transforms."""
    return (
        f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/image/fetch/"
        f"{transforms}/{SITE_URL}{master_path}"
    )


def buffer_graphql(query, variables=None):
    """Execute a GraphQL query against Buffer API."""
    if not BUFFER_API_TOKEN:
        print("  ERROR: BUFFER_API_TOKEN not set", file=sys.stderr)
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:500]
        print(f"  ERROR calling Buffer API: HTTP {e.code}", file=sys.stderr)
        print(f"  Response: {body}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ERROR calling Buffer API: {e}", file=sys.stderr)
        return None


def get_buffer_channels():
    """Query Buffer for available channels and return a mapping from service name to channel ID."""
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
        print("  ERROR: No organizations found in Buffer account", file=sys.stderr)
        return {}

    org_id = orgs[0]["id"]
    print(f"  Organization: {orgs[0].get('name', 'N/A')} ({org_id})")

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
            print(f"  Channel: {ch.get('name', 'N/A')} ({service}) = {ch_id}")

    return channel_map


def gql_escape(s):
    """Escape a string for inline use in a GraphQL query."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def create_buffer_draft(channel_id, text, photo_url=None):
    """Create a draft post in Buffer for a specific channel."""
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
          code
        }}
      }}
    }}
    """

    result = buffer_graphql(query)
    if not result:
        # If we included an image and it failed, retry without image
        if photo_url:
            print("  Retrying without image attachment...", file=sys.stderr)
            return create_buffer_draft(channel_id, text, photo_url=None)
        return None

    data = result.get("data", {}).get("createPost", {})
    if "post" in data:
        post = data["post"]
        return post.get("id")
    else:
        msg = data.get("message", "Unknown error")
        code = data.get("code", "")
        print(f"  Buffer error: {msg} (code: {code})", file=sys.stderr)
        return None


def finalize_text(text, post_url):
    """Append the article URL to the social copy."""
    return f"{text}\n\n{post_url}"


def broadcast_post(filepath, dry_run=False):
    """Broadcast a single post to configured social channels."""
    print(f"\n{'=' * 60}")
    print(f"Processing: {filepath}")
    print(f"{'=' * 60}")

    try:
        fm, fm_raw, body, content = parse_frontmatter(filepath)
    except Exception as e:
        print(f"  SKIP: {e}")
        return False

    config = get_broadcast_config(fm)
    print(f"  Broadcast config: enabled={config['enabled']}, sent={config['sent']}, channels={config['channels']}")

    if not config["enabled"]:
        print("  SKIP: broadcast not enabled")
        return None

    if config["sent"]:
        print("  SKIP: already sent")
        return None

    # Determine active channels
    active_channels = config["channels"] if config["channels"] else DEFAULT_CHANNELS

    print(f"  Active channels: {active_channels}")

    post_info = get_post_info(fm, filepath)
    master_image = get_master_image(fm)
    print(f"  Title: {post_info['title']}")
    print(f"  URL: {post_info['url']}")
    print(f"  Master image: {master_image or 'NONE'}")

    if dry_run:
        print("  DRY RUN - skipping LLM and Buffer calls")
        return True

    # Step 1: Generate social copy via LLM
    print("  Generating social copy via GitHub Models...")
    copy = call_github_models(post_info, active_channels)
    if not copy:
        print("  FAILED to generate social copy")
        return False
    print("  Copy generated successfully")

    # Step 2: Resolve Buffer channels
    print("  Resolving Buffer channels...")
    channel_map = get_buffer_channels()
    if not channel_map:
        print("  FAILED to resolve Buffer channels")
        return False
    print(f"  Found channels: {list(channel_map.keys())}")

    # Step 3: Create drafts in Buffer
    created_count = 0
    for ch_type in active_channels:
        if ch_type not in channel_map:
            print(f"  WARNING: Channel '{ch_type}' not found in Buffer (available: {list(channel_map.keys())})")
            continue

        if ch_type not in SOCIAL_CROPS:
            print(f"  WARNING: No crop config for channel '{ch_type}'")
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
            print(f"  WARNING: No copy generated for {ch_type}")
            continue

        # Build Cloudinary URL for the social crop
        transforms = SOCIAL_CROPS[ch_type]["transforms"]
        if master_image:
            photo_url = cloudinary_url(master_image, transforms)
        else:
            photo_url = None

        print(f"  Creating draft for {ch_type} (channel: {ch_id})...")
        print(f"    Text length: {len(text)} chars")
        if photo_url:
            print(f"    Image: {photo_url}")

        draft_id = create_buffer_draft(ch_id, text, photo_url)
        if draft_id:
            print(f"  ✅ Draft created: {draft_id}")
            created_count += 1
        else:
            print(f"  ❌ Failed to create draft for {ch_type}")

    if created_count == 0:
        print("  FAILED: No drafts were created")
        return False

    # Step 4: Mark as sent in frontmatter
    if not dry_run:
        update_file_frontmatter(filepath, fm, "broadcast.sent", True)
        print(f"  Updated frontmatter: broadcast.sent = true")

    print(f"  Done: {created_count} draft(s) created")
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
        print("Usage: python3 _scripts/broadcast.py [--dry-run] [--posts] post1.md [post2.md ...]")
        sys.exit(1)

    results = {}
    all_ok = True
    for post_path in post_args:
        if not os.path.exists(post_path):
            print(f"ERROR: File not found: {post_path}")
            all_ok = False
            continue
        result = broadcast_post(post_path, dry_run=dry_run)
        results[post_path] = result

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    for path, result in results.items():
        icon = "✅" if result else ("⏭️" if result is None else "❌")
        print(f"  {icon} {path}")

    if not all_ok or any(r is False for r in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
