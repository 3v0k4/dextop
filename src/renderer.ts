import "./main.css";
import spinnerPath from "./images/spinner.gif";
import type { Region, Unit } from "./index";

const spinner = document.querySelector("#spinner");
if (!(spinner instanceof HTMLImageElement)) throw new Error("Image not found");
spinner.src = spinnerPath;

const form = document.querySelector("form");
if (!(form instanceof HTMLFormElement)) throw new Error("Form not found");

const submit = document.querySelector("#submit");
if (!(submit instanceof HTMLButtonElement))
  throw new Error("Submit button not found");

const emailInput = document.querySelector("#email");
if (!(emailInput instanceof HTMLInputElement))
  throw new Error("Email input not found");

const passwordInput = document.querySelector("#password");
if (!(passwordInput instanceof HTMLInputElement))
  throw new Error("Password input not found");

const us = document.querySelector("#us");
if (!(us instanceof HTMLInputElement)) throw new Error("Us input not found");

const eu = document.querySelector("#eu");
if (!(eu instanceof HTMLInputElement)) throw new Error("Eu input not found");

const apac = document.querySelector("#apac");
if (!(apac instanceof HTMLInputElement)) throw new Error("APAC input not found");

const mmol = document.querySelector("#mmolL");
if (!(mmol instanceof HTMLInputElement))
  throw new Error("mmol/L input not found");

const mgdl = document.querySelector("#mgdL");
if (!(mgdl instanceof HTMLInputElement))
  throw new Error("mg/dL input not found");

const error = document.querySelector("#error");
if (!(error instanceof HTMLParagraphElement))
  throw new Error("Error paragraph not found");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSubmitting(submit, spinner);
  const formData = new FormData(form);
  const data = {
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    region: parseRegion(String(formData.get("region"))),
    unit: parseUnit(String(formData.get("unit"))),
  };
  await window.versions.start(data);
});

const parseRegion = (region: string): Region | "" => {
  switch (region) {
    case "us":
      return "us";
    case "eu":
      return "eu";
    case "apac":
      return "apac";
    default:
      return "";
  }
};

const parseUnit = (unit: string): Unit | "" => {
  switch (unit) {
    case "mg/dL":
      return "mg/dL";
    case "mmol/L":
      return "mmol/L";
    default:
      return "";
  }
};

window.versions.onStartResponse((_, response) => {
  setSubmitted(submit, spinner);
  switch (response._kind) {
    case "ok":
      error.innerText = "";
      return;
    case "wrong-credentials":
      error.innerText = "Credentials are incorrect.";
      return;
    case "error":
      error.innerText = "DexTop cannot connect to Dexcom. Try again later.";
      return;
  }
});

const fillEmail = (email: string) => {
  emailInput.value = email;
};

const fillPassword = (password: string) => {
  passwordInput.value = password;
};

const selectRegion = (region: "us" | "eu" | "apac" | "") => {
  switch (region) {
    case "us": {
      us.checked = true;
      return;
    }
    case "eu": {
      eu.checked = true;
      return;
    }
    case "apac": {
      apac.checked = true;
      return;
    }
    case "": {
      return;
    }
  }
};

const selectUnit = (unit: Unit | "") => {
  switch (unit) {
    case "mg/dL": {
      mgdl.checked = true;
      return;
    }
    case "mmol/L": {
      mmol.checked = true;
      return;
    }
    case "": {
      return;
    }
  }
};

const { email, region, password, unit } = window.versions.state;

fillEmail(email);
fillPassword(password);
selectRegion(region);
selectUnit(unit);

window.versions.onSession((_, { email, region, password, unit }) => {
  fillEmail(email);
  fillPassword(password);
  selectRegion(region);
  selectUnit(unit);

  if (email !== "" && password !== "" && region !== "" && unit !== "") {
    submit.click();
  }
});

const setSubmitting = (
  submit: HTMLButtonElement,
  spinner: HTMLImageElement
) => {
  submit.disabled = true;
  submit.style.display = "none";
  spinner.style.display = "block";
};

const setSubmitted = (submit: HTMLButtonElement, spinner: HTMLImageElement) => {
  submit.disabled = false;
  submit.style.display = "block";
  spinner.style.display = "none";
};
