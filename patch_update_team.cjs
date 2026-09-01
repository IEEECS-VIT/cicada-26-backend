const fs = require('fs');
let content = fs.readFileSync('src/controllers/admin/adminTeamController.ts', 'utf8');

content = content.replace(
  `    if (name === undefined && is_disqualified === undefined) {
      res.status(400).json({ success: false, error: 'At least one of name or is_disqualified is required.' });`,
  `    if (name === undefined && is_disqualified === undefined && assigned_asset_set === undefined) {
      res.status(400).json({ success: false, error: 'No valid fields to update.' });`
);

content = content.replace(
  `      if (typeof is_disqualified === 'boolean') {
        const { error } = await supabase
          .from('teams')
          .update({ is_disqualified })
          .eq('id', team.id);

        if (error) {
          throw new Error('Failed to update disqualification status: ' + error.message);
        }
      }`,
  `      const updates: any = {};
      if (typeof is_disqualified === 'boolean') updates.is_disqualified = is_disqualified;
      if (assigned_asset_set !== undefined) updates.assigned_asset_set = assigned_asset_set;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('teams')
          .update(updates)
          .eq('id', team.id);
        if (error) {
           throw new Error('Failed to update team: ' + error.message);
        }
      }`
);

fs.writeFileSync('src/controllers/admin/adminTeamController.ts', content);
