ALTER TABLE public.bank_statements ADD COLUMN IF NOT EXISTS banco_codigo text;

CREATE INDEX IF NOT EXISTS idx_bank_statements_user_banco ON public.bank_statements (user_id, banco);
CREATE INDEX IF NOT EXISTS idx_bank_statements_user_conta ON public.bank_statements (user_id, agencia, conta);
CREATE INDEX IF NOT EXISTS idx_bank_statements_user_titular ON public.bank_statements (user_id, titular);
CREATE INDEX IF NOT EXISTS idx_bank_statements_user_data ON public.bank_statements (user_id, data);

UPDATE public.bank_statements bs
   SET titular = COALESCE(bs.titular, ba.titular),
       documento_titular = COALESCE(bs.documento_titular, ba.documento),
       banco_codigo = COALESCE(bs.banco_codigo, ba.banco_codigo)
  FROM public.bank_accounts ba
 WHERE bs.account_id = ba.id
   AND (bs.titular IS NULL OR bs.documento_titular IS NULL OR bs.banco_codigo IS NULL);

UPDATE public.bank_statements bs
   SET titular = ba.titular,
       documento_titular = COALESCE(bs.documento_titular, ba.documento)
  FROM public.bank_accounts ba
 WHERE bs.account_id IS NULL
   AND bs.titular IS NULL
   AND ba.user_id = bs.user_id
   AND ba.agencia = bs.agencia
   AND ba.conta = bs.conta;

ALTER TABLE public.drive_links ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'extrato';
ALTER TABLE public.drive_links ADD COLUMN IF NOT EXISTS file_kind text NOT NULL DEFAULT 'ofx';

ALTER TABLE public.drive_links DROP CONSTRAINT IF EXISTS drive_links_user_id_url_key;
DROP INDEX IF EXISTS public.drive_links_user_id_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS drive_links_user_module_kind_url_key
  ON public.drive_links (user_id, module, file_kind, url);