export function skillsToRows(skills) {
  if (Array.isArray(skills)) return skills;
  return [
    { id: 'sk-tech',  category: 'Technical',  items: (skills?.technical || []).join(', ') },
    { id: 'sk-tools', category: 'Tools',       items: (skills?.tools     || []).join(', ') },
    { id: 'sk-lang',  category: 'Languages',   items: (skills?.languages || []).join(', ') },
    { id: 'sk-soft',  category: 'Soft Skills', items: (skills?.soft      || []).join(', ') },
  ].filter((r) => r.items);
}
