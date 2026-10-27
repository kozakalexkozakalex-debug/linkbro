// Цвет точки проекта — по порядку проекта в команде (один и тот же везде)
const DOTS = ["#FF6F00", "#6CA7FF", "#3DD68C", "#F2B33D", "#C084FC", "#F472B6", "#2DD4BF"];
export const projectDot = (i: number) => DOTS[i % DOTS.length];
