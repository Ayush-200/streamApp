function getGridLayout(participantCount) {
  if (participantCount <= 2) return { rows: 1, cols: 2 };
  if (participantCount <= 4) return { rows: 2, cols: 2 };
  return { rows: 2, cols: 3 }; // up to 6
}
export default getGridLayout;