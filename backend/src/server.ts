import "dotenv/config";
import { createApp } from "./app";
import { InMemoryBillRepository } from "./repository/inMemoryBillRepository";
import { InMemoryAccountRepository } from "./repository/inMemoryAccountRepository";
import { createClient } from "@supabase/supabase-js";
import { SupabaseAccountRepository } from "./repository/supabaseAccountRepository";
import { SupabaseBillRepository } from "./repository/supabaseBillRepository";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const app = supabaseUrl && supabaseServiceRoleKey
  ? (() => {
      const client = createClient(supabaseUrl, supabaseServiceRoleKey);
      return createApp(
        new SupabaseBillRepository(client),
        new SupabaseAccountRepository(client),
        async (accessToken) => {
          const { data, error } = await client.auth.getUser(accessToken);
          if (error || !data.user?.email) return undefined;
          return {
            id: data.user.id,
            email: data.user.email,
            displayName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
          };
        }
      );
    })()
  : createApp(new InMemoryBillRepository(), new InMemoryAccountRepository());

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing; using in-memory storage");
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SplitReceipt backend listening on http://localhost:${PORT}`);
});
