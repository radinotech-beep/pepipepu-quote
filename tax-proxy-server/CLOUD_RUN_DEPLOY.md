# Pepipepu Tax Proxy - Google Cloud Run Deploy

## 1. Google Cloud project

Create or choose a Google Cloud project, then enable billing and set a monthly budget alert.

Recommended service name:

```bash
pepipepu-tax-server
```

Recommended region:

```bash
asia-northeast3
```

## 2. Deploy

Run these commands inside this folder:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud run deploy pepipepu-tax-server --source . --region asia-northeast3 --allow-unauthenticated --port 8080
```

## 3. Environment variables

Set these in the Cloud Run console. Do not put secret values in source code.

```text
BOLTA_API_KEY
BOLTA_SUPPLIER_KEY
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
SUPPLIER_IDENTIFICATION_NUMBER
SUPPLIER_ORGANIZATION_NAME
SUPPLIER_REPRESENTATIVE_NAME
SUPPLIER_MANAGER_EMAIL
SUPPLIER_TELEPHONE
```

## 4. Cost controls

In the Cloud Run console:

- Set maximum instances to 1 or 2.
- Keep unauthenticated access enabled so GitHub Pages can call the API.
- Set a Google Cloud budget alert, for example USD 5 per month.

## 5. After deploy

Open:

```text
https://YOUR_CLOUD_RUN_URL/health
```

Expected response:

```json
{"ok":true,"service":"pepipepu-bolta-tax-proxy"}
```

After the URL is confirmed, update `index.html` API URLs to use the Cloud Run URL:

```text
https://YOUR_CLOUD_RUN_URL/issue-tax-invoice
https://YOUR_CLOUD_RUN_URL/extract-bizreg
```
