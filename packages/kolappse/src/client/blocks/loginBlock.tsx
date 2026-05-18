import { LoginPicker } from "../LoginPicker.js";
import { registerBlock } from "./registry.js";

registerBlock({
  path: "/login.php",
  selector: (doc) =>
    [...doc.querySelectorAll("td > b")]
      .find((el) => el.textContent?.trim() === "Enter the Kingdom:")
      ?.closest("table"),
  component: <LoginPicker />,
});
