import "./style.css";

export const metadata = { title: "Collection manager", description: "Manage your API records" };

export default function Layout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
