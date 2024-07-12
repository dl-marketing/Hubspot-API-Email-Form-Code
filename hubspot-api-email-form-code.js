<script>
(async function() {
  async function fetchWithTimeout(resource, options, timeout = 2000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(resource, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response;
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    } finally {
      clearTimeout(id);
    }
  }

  async function getIpAddress() {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      if (!data.ip) throw new Error("IP address not found");
      return data.ip;
    } catch (error) {
      console.error("Error fetching IP address:", error);
      return null;
    }
  }

  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  async function validateEmail(email) {
    if (!isValidEmail(email)) {
      return { isValid: false, result: "invalid_email" };
    }

    const validationUrl = `https://validate-email-endpoint.vercel.app/api/validate-email?email=${encodeURIComponent(email)}`;
    try {
      const response = await fetchWithTimeout(validationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (response.status === 429) {
        return { isValid: false, result: "too_many_requests" };
      } else if (data.result === "invalid" || data.result === "unknown") {
        return { isValid: false, result: "invalid_email" };
      } else {
        return { isValid: data.result === "valid", result: data.result };
      }
    } catch (error) {
      console.error("Error during email validation:", error);
      return { isValid: false, result: "error" };
    }
  }

  function getAdditionalFieldsFromDlmc() {
    const dlmc = JSON.parse(localStorage.getItem("dlmc")) || {};
    const fieldMappings = {
      utmSource: "utm_source",
      utmCampaign: "utm_campaign",
      utmTerm: "utm_term",
      utmContent: "utm_content",
      utmMedium: "utm_medium",
      firstWebsiteVisitAt: "first_website_visit_at",
      landingPage: "landing_page",
      adwordsGclid: "adwords_gclid",
      referrer: "referrer",
      utmSourcesAll: "utm_sources___all",
      utmCampaignsAll: "utm_campaign___all_touches",
      utmContentsAll: "utm_content___all_touches",
      utmTermsAll: "utm_term___all_touches",
      utmMediumsAll: "utm_medium___all_touches",
      utmSourceLast: "utm_source___last_touch",
      utmCampaignLast: "utm_campaign___last_touch",
      utmMediumLast: "utm_medium___last_touch",
      utmContentLast: "utm_content___last_touch",
      utmTermLast: "utm_term___last_touch",
      campaignID: "campaign_id",
      adgroupID: "adgroup_id",
      keywordID: "keyword_id",
      msClkid: "msclkid",
    };

    return Object.entries(fieldMappings)
      .filter(([key]) => dlmc[key])
      .map(([key, hubspotFieldName]) => ({ name: hubspotFieldName, value: dlmc[key] }));
  }

  function getHubspotCookie() {
    const name = "hubspotutk";
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  async function submitForm(form, ipAddress) {
    const email = form.querySelector('input[name="email"]').value;
    const hubspotFormId = "12cc5240-d11a-49aa-b4d9-0f63b72eced5";
    const hubspotPortalId = "39674306";

    const additionalFields = getAdditionalFieldsFromDlmc();
    const hutk = getHubspotCookie();

    if (!hutk) {
      console.error("Hubspot cookie not found");
      return;
    }
    
    const errorMessageContainer = form.parentElement.querySelector(".form-error-messages-container");
    const invalidEmailMessage = form.parentElement.querySelector(".main-demo-form-invalid-email-error-message");
    const tooManyRequestsMessage = form.parentElement.querySelector(".main-demo-form-too-many-requests");
    
    errorMessageContainer.style.display = "none"
    invalidEmailMessage.style.display = "none"
    tooManyRequestsMessage.style.display = "none"

    const validationResult = await validateEmail(email);
    if (!validationResult.isValid) {
      displayErrorMessages(form, validationResult.result, errorMessageContainer, invalidEmailMessage, tooManyRequestsMessage);
      return;
    }
		
    const data = {
      fields: [
        { name: "email", value: email },
        { name: "neverbouncevalidationresult", value: validationResult.result },
        ...additionalFields,
      ],
      context: {
        hutk,
        pageUri: window.location.href,
        pageName: document.title,
        ipAddress,
      },
    };

    try {
      const response = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${hubspotPortalId}/${hubspotFormId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
			
      window.location.href = `https://${window.location.hostname}/demo-form?email=${email}`;
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  }

  function displayErrorMessages(form, result, errorMessageContainer, invalidEmailMessage, tooManyRequestsMessage) {

    errorMessageContainer.style.display = "block";
    if (result === "too_many_requests") {
      tooManyRequestsMessage.style.display = "block";
      invalidEmailMessage.style.display = "none";
    } else if (result === "invalid_email") {
      invalidEmailMessage.style.display = "block";
      tooManyRequestsMessage.style.display = "none";
    } else {
      invalidEmailMessage.style.display = "none";
      tooManyRequestsMessage.style.display = "none";
    }
  }

  const scriptElement = document.currentScript;
  const form = scriptElement.closest("form");
  const ipAddress = await getIpAddress();

  if (!form) {
    console.error("Form not found");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = form.querySelector('input[name="email"]').value;

    await submitForm(form, ipAddress);
  });
})();
</script>
