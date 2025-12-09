(function () {
  // Safety: config must exist
  if (typeof BrregGFConfig === 'undefined' || !BrregGFConfig.profiles) {
    console.warn('[BrregGF] No config found (BrregGFConfig).');
    return;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Try init immediately, otherwise watch DOM changes (GF/Beaver async rendering)
    if (!initForAllProfiles()) {
      const observer = new MutationObserver(function () {
        if (initForAllProfiles()) {
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  });

  function initForAllProfiles() {
    let anyInitialized = false;

    BrregGFConfig.profiles.forEach(function (profile) {
      const ok = initProfile(profile);
      if (ok) {
        anyInitialized = true;
      }
    });

    return anyInitialized;
  }

  function initProfile(profile) {
    const triggerClass = profile.trigger_class;
    const outputs = profile.outputs || {};
    const minChars = profile.min_chars || 2;

    if (!triggerClass) {
      console.warn('[BrregGF] Missing trigger_class in profile:', profile);
      return false;
    }

    // Find input for company name
    const companyInput = findInputByWrapperClass(triggerClass);
    if (!companyInput) {
      // Not necessarily an error – maybe this profile doesn't apply to this page.
      return false;
    }

    // Avoid rebinding
    if (companyInput.dataset.brregBound === '1') {
      return true;
    }
    companyInput.dataset.brregBound = '1';

    console.log('[BrregGF] Initializing profile:', profile.id || 'unnamed', 'on field with class', triggerClass);

    // Resolve output fields via CSS class
    const orgInput   = outputs.orgnr  ? findInputByWrapperClass(outputs.orgnr)   : null;
    const streetInput= outputs.street ? findInputByWrapperClass(outputs.street)  : null;
    const zipInput   = outputs.zip    ? findInputByWrapperClass(outputs.zip)     : null;
    const cityInput  = outputs.city   ? findInputByWrapperClass(outputs.city)    : null;

    // Check if fields should be made uneditable
    const makeFieldsUneditable = profile.make_fields_uneditable === true || profile.make_fields_uneditable === '1' || profile.make_fields_uneditable === 1;

    // Function to set field as uneditable
    function setFieldUneditable(input) {
      if (!input) return;
      input.setAttribute('readonly', true);
      input.setAttribute('disabled', true);
      input.style.backgroundColor = '#f0f0f0';
      input.style.cursor = 'not-allowed';
    }

    // Make org field readonly by default (always, regardless of uneditable setting)
    // Other fields will be made uneditable only after population if the setting is enabled
    if (orgInput) {
      orgInput.setAttribute('readonly', true);
    }

    // Build dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'brreg-gf-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '999';
    dropdown.style.background = '#fff';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '6px';
    dropdown.style.width = companyInput.offsetWidth + 'px';
    dropdown.style.display = 'none';
    dropdown.style.maxHeight = '220px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.marginTop = '4px';
    dropdown.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';

    // Wrap input so dropdown can position below
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';

    const parent = companyInput.parentNode;
    parent.insertBefore(wrapper, companyInput);
    wrapper.appendChild(companyInput);
    wrapper.appendChild(dropdown);

    // Debounce helper
    let debounceTimer;
    function debounce(fn, delay) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fn, delay);
    }

    function getBestAddress(company) {
      const addr = company.forretningsadresse || company.postadresse || null;
      if (!addr) return null;

      const street = Array.isArray(addr.adresse)
        ? addr.adresse.join(', ')
        : (addr.adresse || '');

      return {
        street: street || '',
        zip: addr.postnummer || '',
        city: addr.poststed || '',
      };
    }

    function fetchCompanies(searchTerm) {
      const url = 'https://data.brreg.no/enhetsregisteret/api/enheter?navn=' +
                  encodeURIComponent(searchTerm) + '&size=10';

      fetch(url)
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (!data._embedded || !data._embedded.enheter) {
            dropdown.style.display = 'none';
            // Remove focus state when no results
            companyInput.style.borderColor = '';
            companyInput.style.boxShadow = '';
            return;
          }

          let companies = data._embedded.enheter;
          companies = companies.sort(function (a, b) {
            return a.navn.toLowerCase().localeCompare(b.navn.toLowerCase());
          });

          dropdown.innerHTML = '';

          // Add focus state to input when dropdown is shown
          companyInput.style.borderColor = '#2271b1';
          companyInput.style.boxShadow = '0 0 0 1px #2271b1';

          companies.forEach(function (company, index) {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'brreg-gf-dropdown-item';
            optionDiv.style.padding = '10px 12px';
            optionDiv.style.cursor = 'pointer';
            optionDiv.style.fontSize = '13px';
            optionDiv.style.lineHeight = '1.4';
            optionDiv.style.transition = 'background-color 0.15s ease';
            optionDiv.style.backgroundColor = '#fff';
            
            // Only add border-bottom if not the last item
            if (index < companies.length - 1) {
              optionDiv.style.borderBottom = '1px solid #f0f0f0';
            }
            
            optionDiv.textContent = company.navn + ' (' + company.organisasjonsnummer + ')';

            optionDiv.addEventListener('mouseover', function () {
              optionDiv.style.backgroundColor = '#e8f0fe';
            });
            optionDiv.addEventListener('mouseout', function () {
              optionDiv.style.backgroundColor = '#fff';
            });

            optionDiv.addEventListener('click', function () {
              // Set company name
              companyInput.value = company.navn;
              companyInput.dispatchEvent(new Event('change'));

              // Org number
              if (orgInput) {
                orgInput.value = company.organisasjonsnummer;
                orgInput.dispatchEvent(new Event('change'));
                // Apply uneditable state after setting value if needed
                if (makeFieldsUneditable) {
                  setFieldUneditable(orgInput);
                }
              }

              // Address fields
              const addr = getBestAddress(company);
              if (addr) {
                if (streetInput) {
                  streetInput.value = addr.street;
                  streetInput.dispatchEvent(new Event('change'));
                  if (makeFieldsUneditable) {
                    setFieldUneditable(streetInput);
                  }
                }
                if (zipInput) {
                  zipInput.value = addr.zip;
                  zipInput.dispatchEvent(new Event('change'));
                  if (makeFieldsUneditable) {
                    setFieldUneditable(zipInput);
                  }
                }
                if (cityInput) {
                  cityInput.value = addr.city;
                  cityInput.dispatchEvent(new Event('change'));
                  if (makeFieldsUneditable) {
                    setFieldUneditable(cityInput);
                  }
                }
              }

              dropdown.innerHTML = '';
              dropdown.style.display = 'none';
              // Remove focus state after selection
              companyInput.style.borderColor = '';
              companyInput.style.boxShadow = '';
            });

            dropdown.appendChild(optionDiv);
          });

          dropdown.style.display = companies.length ? 'block' : 'none';
        })
        .catch(function (error) {
          console.error('[BrregGF] Brønnøysund request failed:', error);
          dropdown.style.display = 'none';
          // Remove focus state on error
          companyInput.style.borderColor = '';
          companyInput.style.boxShadow = '';
        });
    }

    // Input listener
    companyInput.addEventListener('input', function () {
      const term = companyInput.value.trim();
      if (term.length < minChars) {
        dropdown.style.display = 'none';
        // Remove focus state when dropdown is hidden
        companyInput.style.borderColor = '';
        companyInput.style.boxShadow = '';
        return;
      }
      debounce(function () {
        fetchCompanies(term);
      }, 300);
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', function (evt) {
      if (!wrapper.contains(evt.target)) {
        dropdown.style.display = 'none';
        // Remove focus state when dropdown is hidden
        companyInput.style.borderColor = '';
        companyInput.style.boxShadow = '';
      }
    });

    return true;
  }

  /**
   * Utility: find Gravity Forms input via wrapper CSS class
   * Assumes structure like <li class="... custom-class ..."><input ...></li>
   */
  function findInputByWrapperClass(cssClass) {
    if (!cssClass) return null;

    // Typical GF markup: .gform_wrapper .customclass input
    let el = document.querySelector('.gform_wrapper .' + cssClass + ' input');
    if (el) {
      return el;
    }

    // Fallback: if someone applied class directly on input
    el = document.querySelector('input.' + cssClass);
    if (el) {
      return el;
    }

    return null;
  }

})();

