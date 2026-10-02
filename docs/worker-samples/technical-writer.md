# Sample output: technical-writer — Penn · Technical Writer

**Test input used:**
```
Topic: Getting started with the Acme Analytics REST API. Audience: Software developers.
```

**Generation time:** 16s
**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)
**Output tokens:** 1084
**Output char count:** 3800

**Full output below:**

---

# Getting Started with the Acme Analytics REST API

This guide walks you through everything you need to make your first API request — from getting your credentials to handling a response.

---

## Prerequisites

Before you start, make sure you have:

- An active Acme Analytics account
- A REST client or HTTP library (curl, Postman, Axios, etc.)
- Basic familiarity with HTTP requests and JSON

---

## Step 1: Get Your API Key

All requests to the Acme Analytics API require authentication via an API key.

1. Log in to your Acme Analytics dashboard.
2. Navigate to **Settings → API Access**.
3. Click **Generate API Key**.
4. Copy your key and store it somewhere secure. You won't be able to view it again after leaving this page.

> **Keep your API key private.** Don't commit it to source control or expose it in client-side code.

---

## Step 2: Understand the Base URL

Every API request is made to the following base URL:

```
https://api.acmeanalytics.com/v1
```

All endpoints are appended to this base. For example, the events endpoint is:

```
https://api.acmeanalytics.com/v1/events
```

---

## Step 3: Authenticate Your Requests

Pass your API key in the request header using the `Authorization` field.

```
Authorization header placeholder
```

Every request must include this header. Requests without it return a `401 Unauthorized` error.

---

## Step 4: Make Your First Request

Let's retrieve a list of events to confirm everything is working.

**Request**

```bash
curl -X GET "https://api.acmeanalytics.com/v1/events" \
  -H "Authorization header placeholder" \
  -H "Content-Type: application/json"
```

**Response**

A successful request returns a `200 OK` status and a JSON payload like this:

```json
{
  "data": [
    {
      "id": "evt_01a2b3c4",
      "name": "page_view",
      "timestamp": "2024-11-10T14:32:00Z",
      "properties": {
        "url": "/pricing",
        "referrer": "google.com"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}
```

---

## Step 5: Handle Common Errors

The API uses standard HTTP status codes. Here's what you'll run into most often:

| Status Code | Meaning | What to Do |
|---|---|---|
| `400 Bad Request` | Your request is malformed or missing required parameters | Check the request body and query parameters |
| `401 Unauthorized` | Missing or invalid API key | Verify your key and Authorization header format |
| `403 Forbidden` | Your account doesn't have permission for this resource | Check your plan or contact support |
| `404 Not Found` | The resource doesn't exist | Double-check the endpoint and any IDs in the path |
| `429 Too Many Requests` | You've exceeded the rate limit | Wait before retrying; see rate limits below |
| `500 Internal Server Error` | Something went wrong on Acme's side | Retry after a short delay; contact support if it persists |

---

## Rate Limits

The API allows **1,000 requests per minute** per API key. If you exceed this limit, requests return a `429` status until the window resets.

The response headers tell you where you stand:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1699630800
```

`X-RateLimit-Reset` is a Unix timestamp indicating when your limit resets.

---

## Next Steps

Now that you're up and running, here are a few things to explore:

- **[Events API Reference](#)** — Full list of endpoints, parameters, and response schemas
- **[Filtering and Pagination](#)** — Narrow down results and page through large datasets
- **[Webhooks](#)** — Push event data to your own endpoints in real time
- **[SDKs](#)** — Official libraries for Node.js, Python, and Ruby

---

*Questions? Reach out to the Acme developer support team at [dev-support@acmeanalytics.com](mailto:dev-support@acmeanalytics.com).*