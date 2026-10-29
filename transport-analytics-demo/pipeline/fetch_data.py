"""Scarica l'estrazione OD e le geometrie di riferimento.

Sorgenti:
  - gs://<bucket>/*.csv               estrazione della matrice OD (BigQuery -> GCS)
  - gs://<bucket>/configurazione.json metadati dell'estrazione (fasce orarie, dimensioni)
  - openpolis/geojson-italy           confini comunali (Piemonte) e provinciali (Italia)

Autenticazione GCS: GOOGLE_APPLICATION_CREDENTIALS (chiave di un service account
con ruolo Storage Object Viewer sul bucket) oppure le credenziali di default di gcloud.
"""

import argparse
import os
import sys
import urllib.request
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
RAW_DIR = DATA_DIR / "raw"
GEO_SRC_DIR = DATA_DIR / "geo_src"

GEO_SOURCES = {
    "comuni_piemonte.geojson": "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_R_1_municipalities.geojson",
    "province_italia.geojson": "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_provinces.geojson",
}


def fetch_bucket(bucket_name: str, force: bool) -> None:
    from google.cloud import storage

    client = storage.Client()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for blob in client.list_blobs(bucket_name):
        if not blob.name.endswith((".csv", ".json")):
            continue
        target = RAW_DIR / Path(blob.name).name
        if target.exists() and target.stat().st_size == blob.size and not force:
            print(f"  = {blob.name} (già presente)")
            continue
        print(f"  ↓ {blob.name} ({blob.size / 1e9:.2f} GB)")
        blob.download_to_filename(target)


def fetch_geo(force: bool) -> None:
    GEO_SRC_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in GEO_SOURCES.items():
        target = GEO_SRC_DIR / name
        if target.exists() and not force:
            print(f"  = {name} (già presente)")
            continue
        print(f"  ↓ {name}")
        urllib.request.urlretrieve(url, target)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", default=os.environ.get("GCS_BUCKET", "transport_analytics"))
    parser.add_argument("--skip-bucket", action="store_true", help="usa i CSV già presenti in data/raw")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not args.skip_bucket:
        print(f"Bucket gs://{args.bucket}")
        fetch_bucket(args.bucket, args.force)
    print("Geometrie")
    fetch_geo(args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
