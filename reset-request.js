const form = document.getElementById("resetRequestForm");
const emailInput = document.getElementById("email");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

function showMessage(text, type) {
  message.textContent = text;
  message.className = "message " + type;
  message.style.display = "block";
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = emailInput.value.trim();

  if (!email) {
    showMessage("Please enter your email address.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(
        data.message ||
          "If this email is registered, a password reset link has been sent.",
        "success"
      );

      form.reset();
    } else {
      showMessage(
        data.error || data.message || "Unable to process your request.",
        "error"
      );
    }
  } catch (error) {
    showMessage(
      "Unable to connect to the server. Please try again.",
      "error"
    );
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Send Reset Link";
});