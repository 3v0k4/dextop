import "./main.css";

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

const error = document.querySelector("#error");
if (!(error instanceof HTMLParagraphElement))
  throw new Error("Error paragraph not found");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submit.disabled = true;
  const formData = new FormData(form);
  const data = {
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    region: parseRegion(String(formData.get("region"))),
  };
  await window.versions.start(data);
});

const parseRegion = (region: string): "us" | "eu" | "" => {
  switch (region) {
    case "us":
      return "us";
    case "eu":
      return "eu";
    default:
      return "";
  }
};

window.versions.onStartResponse((_, response) => {
  submit.disabled = false;
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

const selectRegion = (region: "us" | "eu" | "") => {
  switch (region) {
    case "us": {
      us.checked = true;
      return;
    }
    case "eu": {
      eu.checked = true;
      return;
    }
  }
};

fillEmail(window.versions.state.email);
fillPassword(window.versions.state.password);
selectRegion(window.versions.state.region);

window.versions.onSession((_, { email, region }) => {
  fillEmail(email);
  selectRegion(region);
});
