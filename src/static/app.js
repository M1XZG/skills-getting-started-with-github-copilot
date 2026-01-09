document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Escape to safely render participant names/emails
  const escapeHtml = (value) => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };

  // Unregister a participant
  async function unregisterParticipant(activity, email) {
    try {
      const response = await fetch(`/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      return response.ok;
    } catch (error) {
      console.error("Error unregistering participant:", error);
      return false;
    }
  }

  // Function to fetch activities from API (no cache)
  async function fetchActivities() {
    try {
      const response = await fetch(`/activities?t=${Date.now()}`, { cache: "no-store" });
      const activities = await response.json();

      // Clear loading message and existing options
      activitiesList.innerHTML = "";
      while (activitySelect.options.length > 1) activitySelect.remove(1);

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const participants = Array.isArray(details.participants) ? details.participants : [];
        const spotsLeft = details.max_participants - participants.length;

        activityCard.innerHTML = `
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(details.description)}</p>
          <p><strong>Schedule:</strong> ${escapeHtml(details.schedule)}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants">
            <h5>Participants <span class="participants-count">${participants.length}</span></h5>
            ${
              participants.length
                ? `<ul class="participants-list">
                    ${participants.map(p => `<li>${escapeHtml(p)} <button class="delete-participant" aria-label="Unregister ${escapeHtml(p)}" title="Unregister" data-activity="${escapeHtml(name)}" data-email="${escapeHtml(p)}">🗑️</button></li>`).join("")}
                  </ul>`
                : `<p class="empty">No participants yet</p>`
            }
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Wire up delete buttons
      document.querySelectorAll(".delete-participant").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const { activity, email } = e.currentTarget.dataset;
          const ok = await unregisterParticipant(activity, email);
          if (ok) {
            await fetchActivities();
          }
        });
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        await fetchActivities(); // refresh cards (updates participants + counts)
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
