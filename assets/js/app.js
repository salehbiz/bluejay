/* ==========================================================================
   Blue Jay — Post-Hero Caesar Palm Jumeirah Interactions & Animations
   (Hero section is managed exclusively by hero-gpu.js & resilient-hero-scrub.js)
   ========================================================================== */

(function () {
  "use strict";

  /* --------------------------------------------------------------------------
     1. Header Mobile Menu Toggle (Preserved)
     -------------------------------------------------------------------------- */
  function initMobileMenu() {
    var openTrigger = document.querySelector(".header__col.is--3");
    var closeTrigger = document.querySelector(".mobile-menu .icon-24");
    var mobileMenu = document.querySelector(".mobile-menu");
    if (!mobileMenu) return;

    if (openTrigger) {
      openTrigger.addEventListener("click", function () {
        mobileMenu.classList.add("is--open");
        mobileMenu.style.display = "flex";
      });
    }
    if (closeTrigger) {
      closeTrigger.addEventListener("click", function () {
        mobileMenu.classList.remove("is--open");
        mobileMenu.style.display = "";
      });
    }
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileMenu.classList.remove("is--open");
        mobileMenu.style.display = "";
      });
    });
  }

  /* --------------------------------------------------------------------------
     2. Stagger Cards Carousel (#membership)
     -------------------------------------------------------------------------- */
  var STAGGER_ITEMS = [
    {
      tempId: 0,
      testimonial: "Private berthing, sunset charters, and waterfront dining overlooking the Arabian Gulf.",
      by: "Signature Yacht Club",
      imgSrc: "/assets/icons/variants__icon-1.svg"
    },
    {
      tempId: 1,
      testimonial: "Direct step-off access from Villa Bluejay onto 90 km of tranquil white-sand shores.",
      by: "Private Frond Beachfront",
      imgSrc: "/assets/icons/variants__icon-1.svg"
    },
    {
      tempId: 2,
      testimonial: "Holistic spa sanctuaries, thermal suites, and oceanfront mindfulness pavilions across the Crescent.",
      by: "Signature Wellness & Eco Resorts",
      imgSrc: "/assets/icons/variants__icon-1.svg"
    },
    {
      tempId: 3,
      testimonial: "Championship racquet courts, beachfront jogging tracks along The Spine, and private fitness clubs.",
      by: "Sports & Wellness Club",
      imgSrc: "/assets/icons/variants__icon-1.svg"
    },
    {
      tempId: 4,
      testimonial: "Lushly landscaped pocket parks, shaded pedestrian walkways, and gated 24/7 frond security.",
      by: "Pocket Gardens & Frond Enclaves",
      imgSrc: "/assets/icons/variants__icon-1.svg"
    },
    {
      tempId: 5,
      testimonial: "Curated fine dining, sunset beach clubs, and luxury retail along the Sunrise & Sunset Promenades.",
      by: "Luxury Lifestyle Mall & Promenades",
      imgSrc: "/assets/icons/variants__icon-1.svg"
    }
  ];

  function initStaggerCarousel() {
    var track = document.getElementById("stagger-cards-track");
    var prevBtn = document.getElementById("stagger-prev");
    var nextBtn = document.getElementById("stagger-next");
    if (!track) return;

    var list = STAGGER_ITEMS.slice();
    var cardSize = window.matchMedia("(min-width: 640px)").matches ? 365 : 290;

    function getPosition(index, length) {
      return length % 2 ? index - (length + 1) / 2 : index - length / 2;
    }

    function renderCards() {
      track.innerHTML = "";
      list.forEach(function (item, idx) {
        var pos = getPosition(idx, list.length);
        var isCenter = pos === 0;
        var card = document.createElement("div");
        card.className = "stagger-card " + (isCenter ? "is-center" : "is-side");
        card.style.width = cardSize + "px";
        card.style.height = cardSize + "px";
        var translateX = (cardSize / 1.5) * pos;
        var translateY = isCenter ? -65 : pos % 2 ? 15 : -15;
        var rotate = isCenter ? 0 : pos % 2 ? 2.5 : -2.5;
        card.style.transform =
          "translate(-50%, -50%) translateX(" +
          translateX +
          "px) translateY(" +
          translateY +
          "px) rotate(" +
          rotate +
          "deg)";
        card.style.boxShadow = isCenter
          ? "0px 15px 40px rgba(0,0,0,0.15)"
          : "0px 10px 30px rgba(0,0,0,0.05)";

        card.innerHTML =
          '<img src="' +
          item.imgSrc +
          '" alt="' +
          item.by +
          '" class="card-avatar"/>' +
          '<h3 class="card-quote">' +
          item.testimonial +
          "</h3>" +
          '<p class="card-author">' +
          item.by +
          "</p>";

        card.addEventListener("click", function () {
          handleMove(pos);
        });
        track.appendChild(card);
      });
    }

    function handleMove(steps) {
      if (steps === 0) return;
      if (steps > 0) {
        for (var i = steps; i > 0; i--) {
          var first = list.shift();
          if (!first) return;
          list.push(Object.assign({}, first, { tempId: Math.random() }));
        }
      } else {
        for (var j = steps; j < 0; j++) {
          var last = list.pop();
          if (!last) return;
          list.unshift(Object.assign({}, last, { tempId: Math.random() }));
        }
      }
      renderCards();
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        handleMove(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        handleMove(1);
      });
    }

    window.addEventListener("resize", function () {
      var nextSize = window.matchMedia("(min-width: 640px)").matches ? 365 : 290;
      if (nextSize !== cardSize) {
        cardSize = nextSize;
        renderCards();
      }
    });

    renderCards();
  }

  /* --------------------------------------------------------------------------
     3. Layout Bento Modal & Lightbox (#layouts)
     -------------------------------------------------------------------------- */
  var LAYOUT_DATA = {
    studio: {
      title: "Ground Floor · 250.39 m² + 50.41 m² Garage",
      description: "Sunlit central courtyard, formal living & dining pavilions, dual kitchens, guest suite, and staff quarters.",
      areas: {
        "Living Room": [
          {
            id: 101,
            title: "Formal Living Saloon (7.2 × 6.5m)",
            desc: "Floor-to-ceiling glazing framing the beachfront terrace and pool",
            url: "/assets/apartment_interiors/interior_studio_living_1_768x432.jpg"
          },
          {
            id: 102,
            title: "Beachfront Dining Pavilion (6.2 × 5.0m)",
            desc: "Seamless indoor-outdoor entertaining beside the sea",
            url: "/assets/apartment_interiors/interior_studio_living_2_768x432.jpg"
          },
          {
            id: 103,
            title: "Sculptural Timber & Stone Detailing",
            desc: "Warm natural finishes curated by SAOTA Architects",
            url: "/assets/apartment_interiors/interior_studio_tv-wall-1_768x432.jpg"
          },
          {
            id: 104,
            title: "Sunlit Central Courtyard View",
            desc: "Daylight drawn deep into the heart of the residence",
            url: "/assets/apartment_interiors/interior_studio_living_3_768x886.jpg"
          }
        ],
        Bedroom: [
          {
            id: 111,
            title: "Ground-Floor Guest Suite (4.0 × 4.0m)",
            desc: "Private en-suite sanctuary overlooking the garden courtyard",
            url: "/assets/apartment_interiors/interior_studio_bed_1_768x432.jpg"
          }
        ],
        Bathroom: [
          {
            id: 121,
            title: "Guest En-Suite Bath (3.3 × 2.5m)",
            desc: "Honed natural stone vanity and walk-in rain shower",
            url: "/assets/apartment_interiors/interior_studio_bath_1_768x886.jpg"
          },
          {
            id: 122,
            title: "Formal Powder Room (1.7 × 1.7m)",
            desc: "Bespoke lighting and tactile stone surfaces off the foyer",
            url: "/assets/apartment_interiors/interior_studio_bath_2_768x886.jpg"
          },
          {
            id: 123,
            title: "Artisanal Fixtures & Finishes",
            desc: "Brushed metallic accents and warm architectural lighting",
            url: "/assets/apartment_interiors/interior_studio_bath_3_768x432.jpg"
          }
        ],
        Kitchen: [
          {
            id: 131,
            title: "Designer Show Kitchen (5.4 × 2.9m)",
            desc: "Sculptural island connecting directly to the dining pavilion",
            url: "/assets/apartment_interiors/interior_studio_kitchen_1_768x432.jpg"
          },
          {
            id: 132,
            title: "Chef’s Back Kitchen (5.2 × 3.5m)",
            desc: "Full culinary preparation suite with utility & laundry access",
            url: "/assets/apartment_interiors/interior_studio_kitchen_2_768x432.jpg"
          },
          {
            id: 133,
            title: "Integrated Entertaining Counter",
            desc: "Crafted stone worktops and custom timber cabinetry",
            url: "/assets/apartment_interiors/interior_studio_kitchen_3_768x432.jpg"
          }
        ],
        Entrance: [
          {
            id: 141,
            title: "Double-Height Entry Foyer & Lift",
            desc: "Grand arrival sequence with private elevator & 6.1 × 6.2m garage",
            url: "/assets/apartment_interiors/interior_studio_entrance_768x432.jpg"
          }
        ]
      }
    },
    "1+1": {
      title: "First Floor · 250.66 m² + 22.79 m² Balconies",
      description: "Horizon-facing Master Suite, three additional en-suite bedrooms, private family lounge, and study.",
      areas: {
        "Living Room": [
          {
            id: 201,
            title: "First-Floor Family Lounge (5.1 × 4.7m)",
            desc: "Elevated private retreat overlooking the central void",
            url: "/assets/apartment_interiors/interior_apartment_11_living_1_Interactive-LightMix0000_768x432.jpg"
          },
          {
            id: 202,
            title: "Panoramic Sea-Facing Balconies (8.4 × 1.3m)",
            desc: "Uninterrupted views across the Arabian Gulf and frond shoreline",
            url: "/assets/apartment_interiors/interior_apartment_11_living_1_View30_Interactive-LightMix0000_768x886.jpg"
          },
          {
            id: 203,
            title: "Private First-Floor Study (3.5 × 3.4m)",
            desc: "Quiet home office sanctuary bathed in natural light",
            url: "/assets/apartment_interiors/interior_apartment_11_living_3_Interactive-LightMix0000_768x432.jpg"
          },
          {
            id: 204,
            title: "Gallery & Double-Height Void",
            desc: "Architectural connection between ground and upper levels",
            url: "/assets/apartment_interiors/interior_apartment_11_living_5_Interactive-LightMix0000_768x886.jpg"
          },
          {
            id: 205,
            title: "Evening Coastal Ambience",
            desc: "Warm recessed illumination across timber and stone",
            url: "/assets/apartment_interiors/interior_apartment_11_living_7_Interactive-LightMix0000_768x432.jpg"
          }
        ],
        Bedroom: [
          {
            id: 211,
            title: "Master Bedroom Suite (5.0 × 4.0m)",
            desc: "With 4.8 × 1.2m walk-in dressing room and 8.4m sea-view balcony",
            url: "/assets/apartment_interiors/interior_apartment_11_bedroom_1_Interactive-LightMix0000_768x432.jpg"
          },
          {
            id: 212,
            title: "En-Suite Bedrooms 02, 03 & 04 (up to 5.9 × 4.9m)",
            desc: "Generous family suites with walk-in wardrobes and private balconies",
            url: "/assets/apartment_interiors/interior_apartment_11_bedroom_2_Interactive-LightMix0000_768x432.jpg"
          }
        ],
        Bathroom: [
          {
            id: 221,
            title: "Master Spa Bathroom (3.6 × 3.3m)",
            desc: "Freestanding soaking tub, dual stone vanities, and rain shower",
            url: "/assets/apartment_interiors/interior_apartment_11_bath_1_Interactive-LightMix0000_768x886.jpg"
          }
        ],
        Kitchen: [
          {
            id: 231,
            title: "Upper-Level Morning Pantry",
            desc: "Discreet refreshment station serving the family wing",
            url: "/assets/apartment_interiors/interior_apartment_11_kitchen_1_Interactive-LightMix0000_768x432.jpg"
          },
          {
            id: 232,
            title: "Bespoke Millwork & Storage (3.7 × 1.7m)",
            desc: "Refined timber joinery and concealed linen storage",
            url: "/assets/apartment_interiors/interior_apartment_11_kitchen_2_Interactive-LightMix0000_768x432.jpg"
          }
        ],
        Entrance: [
          {
            id: 241,
            title: "First-Floor Lift Lobby & Gallery",
            desc: "Direct private elevator arrival onto the bedroom level",
            url: "/assets/apartment_interiors/interior_apartment_11_entrance_Interactive-LightMix0000_768x432.jpg"
          }
        ]
      }
    },
    "2+1": {
      title: "Second Floor & Roof · 147.64 m² + 48.22 m² Terrace",
      description: "Crowning Sky Lounge, 12.9-metre sunset roof terrace, 6th bedroom suite, study, and pantry.",
      areas: {
        "Living Room": [
          {
            id: 301,
            title: "Panoramic Roof Lounge (9.0 × 5.1m)",
            desc: "Expansive glass-walled entertaining lounge under the sky",
            url: "/assets/apartment_interiors/interior_apartment_21_living_1_768x432.jpg"
          },
          {
            id: 302,
            title: "Sea-Facing Roof Terrace (12.9 × 4.3m)",
            desc: "48.22 m² open-air deck for sunset gatherings by the sea",
            url: "/assets/apartment_interiors/interior_apartment_21_living_3_768x432.jpg"
          },
          {
            id: 303,
            title: "Second-Floor Study (3.2 × 3.3m)",
            desc: "Elevated library and contemplation space on the top floor",
            url: "/assets/apartment_interiors/interior_apartment_21_living_4_768x432.jpg"
          },
          {
            id: 304,
            title: "Indoor-Outdoor Horizon Flow",
            desc: "Seamless transition between the sky lounge and coastal terrace",
            url: "/assets/apartment_interiors/interior_apartment_21_living_7_1024x576.jpg"
          }
        ],
        Bedroom: [
          {
            id: 311,
            title: "Penthouse-Level Bedroom 06 (4.2 × 4.0m)",
            desc: "Private top-floor suite with walk-in dressing room",
            url: "/assets/apartment_interiors/interior_apartment_21_bedroom_1_1_768x432.jpg"
          },
          {
            id: 312,
            title: "Private Retreat Dressing & Lounge",
            desc: "Ideal for VIP guests or an elevated private suite",
            url: "/assets/apartment_interiors/interior_apartment_21_bedroom_2_1_768x432.jpg"
          }
        ],
        Bathroom: [
          {
            id: 321,
            title: "Bedroom 06 En-Suite Bath (2.9 × 2.0m)",
            desc: "Natural stone finishes and walk-in glass shower",
            url: "/assets/apartment_interiors/interior_apartment_21_bath_1_1_768x886.jpg"
          },
          {
            id: 322,
            title: "Sky Lounge Powder Room (2.7 × 1.5m)",
            desc: "Dedicated guest powder room serving the rooftop entertaining level",
            url: "/assets/apartment_interiors/interior_apartment_21_bath_2_1_768x886.jpg"
          }
        ],
        Kitchen: [
          {
            id: 331,
            title: "Rooftop Entertaining Pantry (2.8 × 1.8m)",
            desc: "Dedicated service pantry for sunset dining on the roof terrace",
            url: "/assets/apartment_interiors/interior_apartment_21_kitchen_768x432.jpg"
          }
        ],
        Entrance: [
          {
            id: 341,
            title: "Top-Floor Private Lift Arrival",
            desc: "Direct elevator access to the second-floor sky sanctuary",
            url: "/assets/apartment_interiors/interior_apartment_21_entrance_768x432.jpg"
          }
        ]
      }
    }
  };

  function initLayoutBentoModal() {
    var overlay = document.getElementById("layout-modal-overlay");
    var closeBtn = document.getElementById("layout-modal-close");
    var titleEl = document.getElementById("layout-modal-title");
    var descEl = document.getElementById("layout-modal-desc");
    var tabsEl = document.getElementById("layout-modal-tabs");
    var gridEl = document.getElementById("layout-modal-bento-grid");

    var lbOverlay = document.getElementById("bento-lightbox-overlay");
    var lbClose = document.getElementById("bento-lightbox-close");
    var lbPrev = document.getElementById("bento-lightbox-prev");
    var lbNext = document.getElementById("bento-lightbox-next");
    var lbImg = document.getElementById("bento-lightbox-img");
    var lbTitle = document.getElementById("bento-lightbox-title");
    var lbDesc = document.getElementById("bento-lightbox-desc");
    var lbCounter = document.getElementById("bento-lightbox-counter");

    if (!overlay || !tabsEl || !gridEl) return;

    var currentLayoutKey = null;
    var currentTabKey = "Living Room";
    var currentMediaList = [];
    var currentLightboxIdx = null;

    function renderBentoModal() {
      var data = LAYOUT_DATA[currentLayoutKey];
      if (!data) return;
      titleEl.textContent = data.title;
      descEl.textContent = data.description;

      tabsEl.innerHTML = "";
      var areaNames = Object.keys(data.areas);
      areaNames.forEach(function (areaName) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "layout-modal-tab" + (areaName === currentTabKey ? " active" : "");
        btn.textContent = areaName;
        btn.addEventListener("click", function () {
          currentTabKey = areaName;
          renderBentoModal();
        });
        tabsEl.appendChild(btn);
      });

      currentMediaList = data.areas[currentTabKey] || [];
      gridEl.innerHTML = "";
      currentMediaList.forEach(function (item, idx) {
        var card = document.createElement("div");
        card.className = "bento-card";
        card.innerHTML =
          '<img src="' +
          item.url +
          '" alt="' +
          item.title +
          '" loading="lazy"/>' +
          '<div class="bento-card-caption">' +
          "<h4>" +
          item.title +
          "</h4>" +
          "<p>" +
          item.desc +
          "</p>" +
          "</div>";
        card.addEventListener("click", function () {
          openLightbox(idx);
        });
        gridEl.appendChild(card);
      });
    }

    function openLightbox(idx) {
      if (!lbOverlay || !currentMediaList.length) return;
      currentLightboxIdx = idx;
      updateLightbox();
      lbOverlay.classList.add("active");
    }

    function updateLightbox() {
      var item = currentMediaList[currentLightboxIdx];
      if (!item) return;
      lbImg.src = item.url;
      lbImg.alt = item.title;
      lbTitle.textContent = item.title;
      lbDesc.textContent = item.desc;
      lbCounter.textContent = currentLightboxIdx + 1 + " / " + currentMediaList.length;
      var showNav = currentMediaList.length > 1 ? "flex" : "none";
      if (lbPrev) lbPrev.style.display = showNav;
      if (lbNext) lbNext.style.display = showNav;
    }

    function closeLightbox() {
      if (!lbOverlay) return;
      lbOverlay.classList.remove("active");
      currentLightboxIdx = null;
    }

    document.querySelectorAll("[data-open-layout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentLayoutKey = btn.getAttribute("data-open-layout");
        currentTabKey = "Living Room";
        renderBentoModal();
        overlay.classList.add("active");
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        overlay.classList.remove("active");
      });
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });

    if (lbClose) lbClose.addEventListener("click", closeLightbox);
    if (lbOverlay) {
      lbOverlay.addEventListener("click", function (e) {
        if (e.target === lbOverlay) closeLightbox();
      });
    }
    if (lbPrev) {
      lbPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!currentMediaList.length) return;
        currentLightboxIdx = (currentLightboxIdx - 1 + currentMediaList.length) % currentMediaList.length;
        updateLightbox();
      });
    }
    if (lbNext) {
      lbNext.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!currentMediaList.length) return;
        currentLightboxIdx = (currentLightboxIdx + 1) % currentMediaList.length;
        updateLightbox();
      });
    }

    window.addEventListener("keydown", function (e) {
      if (lbOverlay && lbOverlay.classList.contains("active")) {
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowLeft" && lbPrev) lbPrev.click();
        if (e.key === "ArrowRight" && lbNext) lbNext.click();
      } else if (overlay && overlay.classList.contains("active") && e.key === "Escape") {
        overlay.classList.remove("active");
      }
    });
  }

  /* --------------------------------------------------------------------------
     4. FAQ Accordion (#faq)
     -------------------------------------------------------------------------- */
  function initFaqAccordion() {
    var items = document.querySelectorAll(".caesar-post-hero .faq-item");
    items.forEach(function (item) {
      item.addEventListener("click", function () {
        var isActive = item.classList.contains("active");
        items.forEach(function (other) {
          other.classList.remove("active");
        });
        if (!isActive) {
          item.classList.add("active");
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     5. Contact Form Validation (#contact)
     -------------------------------------------------------------------------- */
  function initContactForm() {
    var form = document.getElementById("caesar-contact-form");
    var successBlock = document.getElementById("caesar-contact-success");
    if (!form) return;

    var selectEl = form.querySelector('select[name="apartmentType"]');
    if (selectEl) {
      selectEl.addEventListener("change", function () {
        selectEl.style.color = selectEl.value ? "var(--color-white)" : "rgba(255,255,255,0.4)";
      });
    }

    function validateField(name, val) {
      if (name === "name") return val.trim() ? "" : "Required";
      if (name === "email") {
        if (!val.trim()) return "Required";
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? "" : "Please enter a valid email";
      }
      if (name === "phone") return val.trim() ? "" : "Required";
      if (name === "apartmentType" || name === "consent") return val ? "" : "Required";
      return "";
    }

    function showFieldError(name, msg) {
      var errEl = form.querySelector('[data-error-for="' + name + '"]');
      var inputEl = form.querySelector('[name="' + name + '"]');
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = msg ? "block" : "none";
      }
      if (inputEl && inputEl.type !== "checkbox") {
        inputEl.style.borderColor = msg ? "#ff4d4d" : "";
      }
    }

    ["name", "email", "phone", "apartmentType", "consent"].forEach(function (fieldName) {
      var input = form.querySelector('[name="' + fieldName + '"]');
      if (!input) return;
      input.addEventListener("blur", function () {
        var val = input.type === "checkbox" ? input.checked : input.value;
        showFieldError(fieldName, validateField(fieldName, val));
      });
      input.addEventListener("focus", function () {
        showFieldError(fieldName, "");
      });
      input.addEventListener("change", function () {
        var val = input.type === "checkbox" ? input.checked : input.value;
        showFieldError(fieldName, validateField(fieldName, val));
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var hasError = false;
      ["name", "email", "phone", "apartmentType", "consent"].forEach(function (fieldName) {
        var input = form.querySelector('[name="' + fieldName + '"]');
        if (!input) return;
        var val = input.type === "checkbox" ? input.checked : input.value;
        var err = validateField(fieldName, val);
        showFieldError(fieldName, err);
        if (err) hasError = true;
      });
      if (!hasError) {
        form.style.display = "none";
        if (successBlock) successBlock.style.display = "flex";
      }
    });
  }

  /* --------------------------------------------------------------------------
     6. Consultation Booking Modal
     -------------------------------------------------------------------------- */
  function initBookingModal() {
    var modal = document.getElementById("caesar-booking-modal");
    var closeBtn = document.getElementById("caesar-booking-close");
    var calGrid = document.getElementById("booking-calendar-grid");
    var timesWrap = document.getElementById("booking-times-wrap");
    var timesTitle = document.getElementById("booking-times-title");
    var timesList = document.getElementById("booking-times-list");
    var step1 = document.getElementById("booking-step-1");
    var step2 = document.getElementById("booking-step-2");
    var step3 = document.getElementById("booking-step-3");
    var summaryText = document.getElementById("booking-summary-text");
    var doneText = document.getElementById("booking-done-text");
    var backBtn = document.getElementById("booking-step-back");
    var doneCloseBtn = document.getElementById("booking-done-close");
    var bookingForm = document.getElementById("caesar-booking-form");

    if (!modal || !calGrid) return;

    var selectedDay = null;
    var selectedTime = null;
    var times = ["09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"];

    function renderCalendar() {
      calGrid.innerHTML = "<span></span>";
      for (var d = 1; d <= 30; d++) {
        (function (dayNum) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "calendar-day";
          btn.textContent = String(dayNum);
          if (selectedDay === dayNum) {
            btn.style.backgroundColor = "#222";
            btn.style.color = "#fff";
            btn.style.fontWeight = "bold";
          }
          btn.addEventListener("click", function () {
            selectedDay = dayNum;
            selectedTime = null;
            renderCalendar();
            renderTimes();
          });
          calGrid.appendChild(btn);
        })(d);
      }
    }

    function renderTimes() {
      if (!selectedDay) {
        timesWrap.style.display = "none";
        return;
      }
      timesWrap.style.display = "block";
      timesTitle.textContent = "Available times for June " + selectedDay;
      timesList.innerHTML = "";
      times.forEach(function (t) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "time-item";
        btn.style.cssText =
          "padding:0.8rem;border:1px solid #ddd;border-radius:8px;cursor:pointer;text-align:center;background:#fff;font-weight:500;";
        btn.textContent = t;
        btn.addEventListener("click", function () {
          selectedTime = t;
          showStep(2);
        });
        timesList.appendChild(btn);
      });
    }

    function showStep(n) {
      step1.style.display = n === 1 ? "block" : "none";
      step2.style.display = n === 2 ? "block" : "none";
      step3.style.display = n === 3 ? "block" : "none";
      if (n === 2 && summaryText) {
        summaryText.innerHTML =
          "Booking for: <strong>June " + selectedDay + ", 2026</strong> at <strong>" + selectedTime + "</strong>";
      }
      if (n === 3 && doneText) {
        doneText.innerHTML =
          "Your consultation has been booked for <strong>June " +
          selectedDay +
          ", 2026</strong> at <strong>" +
          selectedTime +
          "</strong>. We will reach out to you shortly.";
      }
    }

    function resetAndClose() {
      selectedDay = null;
      selectedTime = null;
      if (bookingForm) bookingForm.reset();
      showStep(1);
      renderCalendar();
      renderTimes();
      modal.classList.remove("active");
    }

    document.querySelectorAll("[data-open-booking]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        renderCalendar();
        showStep(1);
        modal.classList.add("active");
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", resetAndClose);
    if (doneCloseBtn) doneCloseBtn.addEventListener("click", resetAndClose);
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        showStep(1);
      });
    }
    modal.addEventListener("click", function (e) {
      if (e.target === modal) resetAndClose();
    });
    if (bookingForm) {
      bookingForm.addEventListener("submit", function (e) {
        e.preventDefault();
        showStep(3);
      });
    }
  }

  /* --------------------------------------------------------------------------
     7. GSAP Scroll Animations for Post-Hero Caesar Sections
     -------------------------------------------------------------------------- */
  function initCaesarAnimations() {
    if (typeof window.gsap === "undefined" || typeof window.ScrollTrigger === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    var root = document.querySelector(".caesar-post-hero");
    if (!root) return;

    function bindScrollTrigger(triggerEl, tl, startStr) {
      ScrollTrigger.create({
        trigger: triggerEl,
        start: "top bottom",
        onLeaveBack: function () {
          tl.progress(0).pause();
        }
      });
      ScrollTrigger.create({
        trigger: triggerEl,
        start: startStr || "top 75%",
        onEnter: function () {
          tl.play();
        }
      });
    }

    // Tags
    root.querySelectorAll(".tag").forEach(function (el) {
      var tl = gsap.timeline({ paused: true });
      tl.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" });
      bindScrollTrigger(el, tl, "top 90%");
    });

    // Section H2s
    root.querySelectorAll("h2").forEach(function (el) {
      if (el.hasAttribute("data-text-anim")) return;
      var tl = gsap.timeline({ paused: true });
      tl.fromTo(el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out" });
      bindScrollTrigger(el, tl, "top 90%");
    });

    // [data-text-anim]
    root.querySelectorAll("[data-text-anim]").forEach(function (el) {
      var tl = gsap.timeline({ paused: true });
      tl.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out" });
      bindScrollTrigger(el, tl, "top 95%");
    });

    // [data-num-anim]
    root.querySelectorAll("[data-num-anim]").forEach(function (el) {
      var target = parseInt(el.textContent || "0", 10);
      if (isNaN(target)) return;
      var counter = { val: 0 };
      var tl = gsap.timeline({ paused: true });
      tl.to(counter, {
        val: target,
        duration: 2,
        ease: "power2.out",
        snap: { val: 1 },
        onUpdate: function () {
          el.textContent = String(Math.floor(counter.val));
        }
      });
      ScrollTrigger.create({
        trigger: el,
        start: "top 80%",
        once: true,
        onEnter: function () {
          tl.play();
        }
      });
    });

    // [data-img-scale]
    root.querySelectorAll("[data-img-scale]").forEach(function (el) {
      gsap.set(el, { scale: 1.2 });
      var tl = gsap.timeline({ paused: true });
      tl.to(el, { scale: 1, duration: 1.4, ease: "power3.out" });
      bindScrollTrigger(el, tl, "top 80%");
    });

    // [data-img-curtain]
    root.querySelectorAll("[data-img-curtain]").forEach(function (el) {
      gsap.set(el, { width: "0%", overflow: "hidden", display: "block" });
      var tl = gsap.timeline({ paused: true });
      tl.to(el, { width: "100%", duration: 1.2, ease: "expo.out" });
      bindScrollTrigger(el, tl, "top 80%");
    });

    // [data-slide-x]
    root.querySelectorAll("[data-slide-x]").forEach(function (el) {
      var offset = parseFloat(el.getAttribute("data-slide-x") || "0");
      gsap.set(el, { xPercent: offset });
      var tl = gsap.timeline({ paused: true });
      tl.to(el, { xPercent: 0, duration: 1.2, ease: "power3.out" });
      bindScrollTrigger(el, tl, "top 75%");
    });

    // .properties__card & .properties__btn
    root.querySelectorAll(".properties__card").forEach(function (el) {
      gsap.set(el, { scale: 0.85 });
      var tl = gsap.timeline({ paused: true });
      tl.to(el, { scale: 1, duration: 1.2, ease: "power3.out" });
      bindScrollTrigger(el, tl, "top 75%");
    });
    root.querySelectorAll(".properties__btn").forEach(function (el) {
      gsap.set(el, { scale: 0.8, rotation: -90 });
      var tl = gsap.timeline({ paused: true });
      tl.to(el, { scale: 1, rotation: 0, duration: 1, ease: "back.out(1.4)" });
      bindScrollTrigger(el, tl, "top 75%");
    });

    // [data-variant-slide]
    var variantSlides = Array.from(root.querySelectorAll("[data-variant-slide]"));
    if (variantSlides.length > 0) {
      variantSlides.forEach(function (el) {
        gsap.set(el, { xPercent: 100 });
      });
      var vTl = gsap.timeline({ paused: true });
      vTl.to(variantSlides, { xPercent: 0, duration: 1, ease: "power3.out", stagger: 0.15 });
      bindScrollTrigger(variantSlides[0], vTl, "top 80%");
    }

    // Contact titles, info rows & fields
    var contactTitles = root.querySelectorAll(".contact__title");
    if (contactTitles.length >= 2) {
      gsap.set(contactTitles[0], { x: -100, opacity: 0 });
      gsap.set(contactTitles[1], { x: 100, opacity: 0 });
      var cTl = gsap.timeline({ paused: true });
      cTl.to([contactTitles[0], contactTitles[1]], { x: 0, opacity: 1, duration: 1.2, ease: "power3.out" });
      bindScrollTrigger(contactTitles[0], cTl, "top 75%");
    }

    var infoRows = Array.from(root.querySelectorAll(".contact-info-row"));
    if (infoRows.length > 0) {
      infoRows.forEach(function (el) {
        gsap.set(el, { opacity: 0, y: 20 });
      });
      var rTl = gsap.timeline({ paused: true });
      rTl.to(infoRows, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.1 });
      bindScrollTrigger(infoRows[0], rTl, "top 90%");
    }

    var formFields = Array.from(root.querySelectorAll(".contact-form-field"));
    if (formFields.length > 0) {
      formFields.forEach(function (el) {
        gsap.set(el, { opacity: 0, y: 20 });
      });
      var fTl = gsap.timeline({ paused: true });
      fTl.to(formFields, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.08 });
      bindScrollTrigger(formFields[0], fTl, "top 90%");
    }

    var atmos = root.querySelector(".section.mod--atmosphere");
    if (atmos) {
      var atmosH3 = atmos.querySelector(".atmosphere__content .h3");
      var atmosBtn = atmos.querySelector(".atmosphere__content .button");
      if (atmosH3 && atmosBtn) {
        gsap.set(atmosH3, { y: 40, opacity: 0 });
        gsap.set(atmosBtn, { scale: 0.8, opacity: 0 });
        var aTl = gsap.timeline({ paused: true });
        aTl
          .to(atmosH3, { y: 0, opacity: 1, duration: 1, ease: "power3.out" })
          .to(atmosBtn, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.4)" }, "-=0.6");
        bindScrollTrigger(atmos, aTl, "top 60%");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMobileMenu();
    initStaggerCarousel();
    initLayoutBentoModal();
    initFaqAccordion();
    initContactForm();
    initBookingModal();
    initCaesarAnimations();
  });
})();
