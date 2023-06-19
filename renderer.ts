const form = document.querySelector("form");
if (!(form instanceof HTMLFormElement)) throw new Error("Form not found");

const submit = document.querySelector("#submit");
if (!(submit instanceof HTMLButtonElement))
  throw new Error("Submit button not found");

const email = document.querySelector("#email");
if (!(email instanceof HTMLInputElement))
  throw new Error("Email input not found");

const password = document.querySelector("#password");
if (!(password instanceof HTMLInputElement))
  throw new Error("Password input not found");

const error = document.querySelector("#error");
if (!(error instanceof HTMLParagraphElement))
  throw new Error("Error paragraph not found");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submit.disabled = true;
  const formData = new FormData(form);
  const data = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  await window.versions.start(data);
});

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

email.value = window.versions.state.email;
password.value = window.versions.state.password;
