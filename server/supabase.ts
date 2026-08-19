import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  try {
    _supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return _supabaseClient;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize server client:", err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

/**
 * Uploads a generated Invoice PDF to Supabase Storage in the 'factures' bucket.
 * Returns the public or signed URL of the uploaded document.
 */
export async function uploadInvoicePdf(
  invoiceNumber: string,
  pdfBuffer: Buffer | Uint8Array,
  mimeType: string = "application/pdf"
): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const cleanNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `facture_${cleanNumber}_${Date.now()}.pdf`;
  const filePath = `invoices/${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from("factures")
      .upload(filePath, pdfBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn("[Supabase Storage] Error uploading invoice PDF:", error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("factures")
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn("[Supabase Storage] Exception during invoice PDF upload:", err);
    return null;
  }
}

/**
 * Uploads a Payment Proof (Bank receipt, check photo, douane slip) to Supabase Storage.
 * Returns the access URL of the proof.
 */
export async function uploadPaymentProof(
  invoiceId: number,
  fileBuffer: Buffer | Uint8Array,
  originalFileName: string,
  mimeType: string = "image/jpeg"
): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const ext = originalFileName.split(".").pop() || "jpg";
  const filePath = `payments/invoice_${invoiceId}_${Date.now()}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from("preuves_paiement")
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn("[Supabase Storage] Error uploading payment proof:", error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("preuves_paiement")
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn("[Supabase Storage] Exception during payment proof upload:", err);
    return null;
  }
}

/**
 * Generates a temporary signed URL for secure download from Supabase Storage.
 */
export async function getSignedDownloadUrl(
  bucket: string,
  filePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
