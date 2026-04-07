/**
 * js/qr-generator.js
 * Modular QR Code Generator for MediSimple
 * Creates a unique QR code linking to the user's report data.
 */

(function () {
  const QR_LIB_URL = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  const CONTAINER_ID = "qr-code-module";

  /**
   * Loads the QR Code library dynamically to keep the site modular.
   */
  function loadLibrary(callback) {
    if (window.QRCode) {
      callback();
      return;
    }
    const script = document.createElement("script");
    script.src = QR_LIB_URL;
    script.onload = callback;
    document.head.appendChild(script);
  }

  /**
   * Injects the QR code container and styles into the page.
   */
  function injectContainer() {
    // Check if we are on the dashboard page
    const anchor = document.getElementById("aiAndActionSection") || document.querySelector(".db-header");
    if (!anchor) return null;

    // Avoid duplicate injection
    if (document.getElementById(CONTAINER_ID)) return document.getElementById(CONTAINER_ID);

    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.className = "qr-module-card";
    
    // Simple internal styling for isolation
    const style = document.createElement("style");
    style.textContent = `
      .qr-module-card {
        background: var(--white, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 20px;
        padding: 24px;
        margin-top: 24px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: transform 0.3s ease;
      }
      .qr-module-card:hover {
        transform: translateY(-4px);
      }
      .qr-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
      }
      .qr-header h3 {
        margin: 0;
        font-size: 16px;
        color: var(--text-main, #0f172a);
        font-family: 'Syne', sans-serif;
      }
      .qr-canvas-wrap {
        padding: 10px;
        background: #fff;
        border-radius: 12px;
        border: 1px solid #f1f5f9;
      }
      .qr-subtext {
        margin-top: 12px;
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        max-width: 200px;
      }
      @media (max-width: 768px) {
        .qr-module-card {
          margin: 20px;
        }
      }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
      <div class="qr-header">
        <span style="font-size: 20px;">📱</span>
        <h3>Digital Health Pass</h3>
      </div>
      <div class="qr-canvas-wrap" id="qr-target"></div>
      <p class="qr-subtext">Scan to securely view your complete medical history on any device.</p>
    `;

    // Place it after the AI section if it exists, otherwise in a reasonable spot
    anchor.parentNode.insertBefore(container, anchor.nextSibling);
    return container;
  }

  /**
   * Generates the QR code based on user session.
   */
  function generateQR() {
    const session = localStorage.getItem('ms_session') || sessionStorage.getItem('ms_session');
    let userId = "demo";
    if (session) {
      try {
        const user = JSON.parse(session);
        userId = user.id || "demo";
      } catch (e) {}
    }

    // URL pointing to the user's data (simulated based on requirements)
    const reportUrl = `${window.location.origin}/api/history/${userId}`;
    
    loadLibrary(() => {
      const target = document.getElementById("qr-target");
      if (!target) return;
      
      target.innerHTML = ""; // Clear
      new QRCode(target, {
        text: reportUrl,
        width: 140,
        height: 140,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
      console.log("[QR] Generated for user:", userId);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectContainer();
      generateQR();
    });
  } else {
    injectContainer();
    generateQR();
  }

})();
