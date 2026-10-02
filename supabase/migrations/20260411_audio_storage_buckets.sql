-- Audio & Voice workers: Create storage buckets for uploads and outputs

-- Create audio-uploads bucket (temporary input files for ElevenLabs API)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-uploads',
  'audio-uploads',
  false,
  104857600,
  ARRAY[
    'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave',
    'audio/mp4', 'audio/x-m4a', 'audio/m4a',
    'video/mp4', 'video/quicktime', 'video/webm', 'audio/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Create audio-outputs bucket (generated audio files — persisted with tasks)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-outputs',
  'audio-outputs',
  false,
  104857600,
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

-- Service role has full access to both buckets (all ops go through API routes)
CREATE POLICY "Service role manages audio-uploads"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'audio-uploads')
WITH CHECK (bucket_id = 'audio-uploads');

CREATE POLICY "Service role manages audio-outputs"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'audio-outputs')
WITH CHECK (bucket_id = 'audio-outputs');

-- Authenticated users can read audio outputs (for signed URL fallback)
CREATE POLICY "Authenticated users read audio-outputs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audio-outputs');
