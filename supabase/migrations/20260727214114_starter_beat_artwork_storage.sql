update storage.buckets
set allowed_mime_types = array[
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'starter-beats';
