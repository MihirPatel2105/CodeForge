export default function RouteTemplate({ children }: Readonly<{ children: React.ReactNode }>) {
  // PageMotion handles the content transition; chrome stays outside the animation.
  return <>{children}</>;
}
