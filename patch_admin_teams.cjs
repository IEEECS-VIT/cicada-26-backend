const fs = require('fs');
let content = fs.readFileSync('src/controllers/admin/adminTeamController.ts', 'utf8');

content = content.replace(
  `    const { name, is_disqualified } = req.body;`,
  `    const { name, is_disqualified, assigned_asset_set } = req.body;`
);

content = content.replace(
  `    if (name === undefined && is_disqualified === undefined) {
      res.status(400).json({ success: false, error: 'At least one of name or is_disqualified is required.' });`,
  `    if (name === undefined && is_disqualified === undefined && assigned_asset_set === undefined) {
      res.status(400).json({ success: false, error: 'No valid fields to update.' });`
);

content = content.replace(
  `      if (is_disqualified !== undefined) updates.is_disqualified = is_disqualified;`,
  `      if (is_disqualified !== undefined) updates.is_disqualified = is_disqualified;
      if (assigned_asset_set !== undefined) updates.assigned_asset_set = assigned_asset_set;`
);

fs.writeFileSync('src/controllers/admin/adminTeamController.ts', content);
