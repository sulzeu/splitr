import "dotenv/config";
import { createApp } from "./app";
import { InMemoryBillRepository } from "./repository/inMemoryBillRepository";
import { InMemoryAccountRepository } from "./repository/inMemoryAccountRepository";
import { createClient } from "@supabase/supabase-js";
import { SupabaseAccountRepository } from "./repository/supabaseAccountRepository";
import { SupabaseBillRepository } from "./repository/supabaseBillRepository";
import { getAppConfig } from "./config";

const config = getAppConfig();
const app =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? (() => {
        const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey!);
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

if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
  console.warn("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing; using in-memory storage");
}

app.listen(config.port, () => {
  console.log(`SplitReceipt backend listening on http://localhost:${config.port}`);
});
