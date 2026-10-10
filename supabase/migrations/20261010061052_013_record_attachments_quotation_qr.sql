-- Quotation authenticity QR codes and private attachments for finance/document records.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS verification_token text;

UPDATE public.quotations
SET verification_token = encode(gen_random_bytes(16), 'hex')
WHERE verification_token IS NULL;

ALTER TABLE public.quotations
  ALTER COLUMN verification_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS quotations_verification_token_uidx
  ON public.quotations (verification_token);

CREATE OR REPLACE FUNCTION public.verify_quotation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'valid', true,
    'quotation_code', q.quotation_code,
    'price_type', q.price_type,
    'created_at', q.created_at,
    'currency', q.currency,
    'total', q.total,
    'status', q.status,
    'valid_until', q.valid_until,
    'company_name', 'Japan Circular Trading',
    'verified_at', now()
  )
  INTO result
  FROM public.quotations q
  WHERE q.verification_token = p_token
    AND q.status NOT IN ('rejected', 'expired');

  IF result IS NULL THEN
    RETURN json_build_object('valid', false, 'message', 'Quotation not found or invalid');
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_quotation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_quotation(text) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.record_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('invoices', 'quotations', 'payments', 'expenses', 'documents')),
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  object_path text NOT NULL UNIQUE,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_attachments_entity_idx
  ON public.record_attachments (entity_type, entity_id, created_at DESC);

ALTER TABLE public.record_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS record_attachments_select ON public.record_attachments;
CREATE POLICY record_attachments_select
  ON public.record_attachments FOR SELECT TO authenticated
  USING (
    CASE entity_type
      WHEN 'invoices' THEN public.has_permission('invoices', 'view')
      WHEN 'quotations' THEN public.has_permission('sales', 'view')
      WHEN 'payments' THEN public.has_permission('payments', 'view')
      WHEN 'expenses' THEN public.has_permission('expenses', 'view')
      WHEN 'documents' THEN public.has_permission('documents', 'view')
      ELSE false
    END
  );

DROP POLICY IF EXISTS record_attachments_insert ON public.record_attachments;
CREATE POLICY record_attachments_insert
  ON public.record_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND CASE entity_type
      WHEN 'invoices' THEN public.has_permission('invoices', 'create') OR public.has_permission('invoices', 'edit')
      WHEN 'quotations' THEN public.has_permission('sales', 'create') OR public.has_permission('sales', 'edit')
      WHEN 'payments' THEN public.has_permission('payments', 'create') OR public.has_permission('payments', 'edit')
      WHEN 'expenses' THEN public.has_permission('expenses', 'create') OR public.has_permission('expenses', 'edit')
      WHEN 'documents' THEN public.has_permission('documents', 'create') OR public.has_permission('documents', 'edit')
      ELSE false
    END
  );

DROP POLICY IF EXISTS record_attachments_delete ON public.record_attachments;
CREATE POLICY record_attachments_delete
  ON public.record_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR CASE entity_type
      WHEN 'invoices' THEN public.has_permission('invoices', 'edit')
      WHEN 'quotations' THEN public.has_permission('sales', 'edit')
      WHEN 'payments' THEN public.has_permission('payments', 'edit')
      WHEN 'expenses' THEN public.has_permission('expenses', 'edit')
      WHEN 'documents' THEN public.has_permission('documents', 'edit')
      ELSE false
    END
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'record-attachments',
  'record-attachments',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS record_attachments_storage_insert ON storage.objects;
CREATE POLICY record_attachments_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'record-attachments'
    AND CASE (storage.foldername(name))[1]
      WHEN 'invoices' THEN public.has_permission('invoices', 'create') OR public.has_permission('invoices', 'edit')
      WHEN 'quotations' THEN public.has_permission('sales', 'create') OR public.has_permission('sales', 'edit')
      WHEN 'payments' THEN public.has_permission('payments', 'create') OR public.has_permission('payments', 'edit')
      WHEN 'expenses' THEN public.has_permission('expenses', 'create') OR public.has_permission('expenses', 'edit')
      WHEN 'documents' THEN public.has_permission('documents', 'create') OR public.has_permission('documents', 'edit')
      ELSE false
    END
  );

DROP POLICY IF EXISTS record_attachments_storage_select ON storage.objects;
CREATE POLICY record_attachments_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'record-attachments'
    AND EXISTS (
      SELECT 1 FROM public.record_attachments a
      WHERE a.object_path = storage.objects.name
        AND CASE a.entity_type
          WHEN 'invoices' THEN public.has_permission('invoices', 'view')
          WHEN 'quotations' THEN public.has_permission('sales', 'view')
          WHEN 'payments' THEN public.has_permission('payments', 'view')
          WHEN 'expenses' THEN public.has_permission('expenses', 'view')
          WHEN 'documents' THEN public.has_permission('documents', 'view')
          ELSE false
        END
    )
  );

DROP POLICY IF EXISTS record_attachments_storage_delete ON storage.objects;
CREATE POLICY record_attachments_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'record-attachments'
    AND EXISTS (
      SELECT 1 FROM public.record_attachments a
      WHERE a.object_path = storage.objects.name
        AND (
          a.uploaded_by = auth.uid()
          OR CASE a.entity_type
            WHEN 'invoices' THEN public.has_permission('invoices', 'edit')
            WHEN 'quotations' THEN public.has_permission('sales', 'edit')
            WHEN 'payments' THEN public.has_permission('payments', 'edit')
            WHEN 'expenses' THEN public.has_permission('expenses', 'edit')
            WHEN 'documents' THEN public.has_permission('documents', 'edit')
            ELSE false
          END
        )
    )
  );
