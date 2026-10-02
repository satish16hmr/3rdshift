-- Align approved seeded playbook chains, card copy, and displayed costs with runtime behavior.

UPDATE agent_mode_presets
SET
  description = 'Decide what to measure, then turn the results into a clear monthly client report.',
  workers = '[
    {
      "position": 1,
      "worker_id": "kpi-dashboard-writer",
      "form_settings": {
        "metrics_tracked": "[User fills in]",
        "reporting_cadence": "Monthly",
        "stage": "Growth"
      }
    },
    {
      "position": 2,
      "worker_id": "report-writer",
      "form_settings": {
        "audience": "Client stakeholders",
        "report_title": "Monthly client performance report",
        "report_mode": "business_review"
      }
    }
  ]'::jsonb,
  heavy_credits_per_run = 1,
  light_tasks_per_run = 1
WHERE id = '3520b37b-7137-4402-b915-14d528b3746f';

UPDATE agent_mode_presets
SET
  description = 'Publish a deep-dive article every week, then distribute it as a LinkedIn post and press release.',
  workers = '[
    {
      "position": 1,
      "worker_id": "seo-strategist",
      "form_settings": {
        "primary_keyword": "[User fills in]",
        "seo_mode": "keyword_brief"
      }
    },
    {
      "position": 2,
      "worker_id": "content-writer",
      "form_settings": {
        "tone": "Professional",
        "topic": "Use the SEO brief from the previous step as source material",
        "target_audience": "[User fills in]",
        "article_card": "deep_dive"
      }
    },
    {
      "position": 3,
      "worker_id": "linkedin-ghostwriter",
      "form_settings": {
        "post_type": "Framework / Breakdown"
      }
    },
    {
      "position": 4,
      "worker_id": "whitepaper-writer",
      "form_settings": {
        "document_type": "press_release"
      }
    }
  ]'::jsonb,
  heavy_credits_per_run = 3,
  light_tasks_per_run = 1
WHERE id = '818aa017-98a3-4e45-987e-b18ba741af89';
