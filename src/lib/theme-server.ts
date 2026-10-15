import { cookies } from "next/headers";
import { CHOSEN_COOKIE, decodeChosen } from "./theme";

/** The visitor's theme from its cookie; the default when there is none. Server only. */
export async function chosenTheme() {
  return decodeChosen((await cookies()).get(CHOSEN_COOKIE)?.value);
}
