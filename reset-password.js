const form = document.getElementById("resetPasswordForm");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

function showMessage(text, type) {
  message.textContent = text;
  message.className = "message " + type;
  message.style.display = "block";
}

if (!token || !/^[a-f0-9]{64}$/.test(token)) {
  showMessage("Invalid or expired reset link.", "error");
  submitBtn.disabled = true;
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    showMessage("Invalid or expired reset link.", "error");
    return;
  }

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (password.length < 14) {
    showMessage(
      "Password must be at least 14 characters long.",
      "error"
    );
    return;
  }

  if (password !== confirmPassword) {
    showMessage("Passwords do not match.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Resetting...";

  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: token,
        password: password
      })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(
        data.message ||
          "Password reset successfully. You can now log in.",
        "success"
      );

      form.reset();

      setTimeout(() => {
        window.location.href = "/admin.html";
      }, 2000);
    } else {
      showMessage(
        data.error ||
          data.message ||
          "Unable to reset password.",
        "error"
      );

      submitBtn.disabled = false;
      submitBtn.textContent = "Reset Password";
    }
  } catch (error) {
    showMessage(
      "Unable to connect to the server. Please try again.",
      "error"
    );

    submitBtn.disabled = false;
    submitBtn.textContent = "Reset Password";
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  const togglePasswordButton = document.getElementById("togglePassword");
  const toggleConfirmPasswordButton = document.getElementById("toggleConfirmPassword");

  togglePasswordButton.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      togglePasswordButton.textContent = "🙈";
    } else {
      passwordInput.type = "password";
      togglePasswordButton.textContent = "👁️";
    }
  });

  toggleConfirmPasswordButton.addEventListener("click", () => {
    if (confirmPasswordInput.type === "password") {
      confirmPasswordInput.type = "text";
      toggleConfirmPasswordButton.textContent = "🙈";
    } else {
      confirmPasswordInput.type = "password";
      toggleConfirmPasswordButton.textContent = "👁️";
    }
  });
});