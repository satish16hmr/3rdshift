-- Align Client Reporting Chain preset metadata with kpi-dashboard-writer's registry cost.
-- Brody (kpi-dashboard-writer) is taskType heavy, creditCost 1, so this preset is 1H + 2L.
UPDATE agent_mode_presets
SET
  heavy_credits_per_run = 1,
  light_tasks_per_run = 2
WHERE id = '3520b37b-7137-4402-b915-14d528b3746f'
  AND name = 'Client Reporting Chain';
