import type { PublicContactSettingsResponse } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import { ContactPage } from "../../src/public-pages/contact-page";
import { mount } from "../learn/mount";

const settings = (
  overrides: Partial<PublicContactSettingsResponse> = {},
): PublicContactSettingsResponse => ({
  organisation: "HEAT office",
  address: "Room 12\nTSC, University of Dhaka",
  email: "heat@du.ac.bd",
  phone: "+880 2 5566 7788",
  officeHours: "Sunday to Thursday",
  ...overrides,
});

describe("ContactPage", () => {
  test("shows the details as entered with mailto and tel links", async () => {
    const view = await mount(<ContactPage settings={settings()} />);
    expect(view.textContent).toContain("HEAT office");
    expect(view.textContent).toContain("TSC, University of Dhaka");
    expect(view.querySelector('a[href="mailto:heat@du.ac.bd"]')?.textContent).toBe("heat@du.ac.bd");
    expect(view.querySelector('a[href="tel:+880255667788"]')?.textContent).toBe("+880 2 5566 7788");
  });

  test("shows a neutral empty state when nothing has been entered", async () => {
    const view = await mount(
      <ContactPage
        settings={settings({
          organisation: "",
          address: "",
          email: "",
          phone: "",
          officeHours: "",
        })}
      />,
    );
    expect(view.textContent).toContain("Contact details are not available yet");
    expect(view.querySelector("a")).toBeNull();
  });

  test("leaves out fields that were not entered", async () => {
    const view = await mount(<ContactPage settings={settings({ phone: "", officeHours: "" })} />);
    expect(view.textContent).not.toContain("Phone");
    expect(view.textContent).not.toContain("Office hours");
  });
});
