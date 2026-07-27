import { SupabaseClient } from '@supabase/supabase-js';
import { IAdminLogRepository, AdminLog } from '../interfaces';

export class SupabaseAdminLogRepository implements IAdminLogRepository {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async logAction(adminEmail: string, action: string, details: any = null, ipAddress?: string): Promise<void> {
    try {
      // Fetch the admin user's display_name (username) from public.users
      const { data: user } = await this.supabase
        .from('users')
        .select('display_name')
        .eq('email', adminEmail)
        .maybeSingle();

      const adminUsername = user?.display_name || 'System';

      // Always embed the username inside the details object as fallback
      const enrichedDetails = {
        ...details,
        admin_username: adminUsername,
      };

      await this.supabase.from('admin_logs').insert([
        {
          admin_email: adminEmail,
          admin_username: adminUsername,
          action,
          details: enrichedDetails ? JSON.stringify(enrichedDetails) : null,
          ip_address: ipAddress || null,
        },
      ]);
    } catch (e) {
      // Gracefully ignore if table is missing during dev/migration
      console.error('[Admin Audit Log Error]', e);
    }
  }

  async getLogs(limit: number = 100): Promise<AdminLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data.map((item) => ({
        ...item,
        details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details,
      })) as AdminLog[];
    } catch {
      return [];
    }
  }

  async deleteLog(id: string): Promise<void> {
    const { error } = await this.supabase.from('admin_logs').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete admin log: ${error.message}`);
  }

  async clearLogs(): Promise<void> {
    const { error } = await this.supabase.from('admin_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Failed to clear admin logs: ${error.message}`);
  }
}
