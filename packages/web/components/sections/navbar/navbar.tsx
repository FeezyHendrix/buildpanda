import { LogoSymbol } from "@/components/ui/logo";
import { NavbarLayers } from "./navbar-layers";

/** Site navbar. Mounted once in the root layout. */
export function Navbar() {
  return (
    <>
      <LogoSymbol />
      <NavbarLayers />
    </>
  );
}
