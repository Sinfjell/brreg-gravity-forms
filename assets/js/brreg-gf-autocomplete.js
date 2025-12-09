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
    const makeUneditableAfterPopulation = profile.make_uneditable_after_population === true || profile.make_uneditable_after_population === '1' || profile.make_uneditable_after_population === 1;

    // Function to set field as uneditable
    // Note: Using readonly instead of disabled so values are submitted with the form
    function setFieldUneditable(input) {
      if (!input) return;
      input.setAttribute('readonly', true);
      // Don't use disabled - it prevents form submission
      // readonly still allows the value to be submitted
      input.style.backgroundColor = '#f0f0f0';
      input.style.cursor = 'not-allowed';
      input.style.opacity = '0.7';
    }

    // Function to make field editable again (reverse of setFieldUneditable)
    function setFieldEditable(input) {
      if (!input) return;
      input.removeAttribute('readonly');
      input.style.backgroundColor = '';
      input.style.cursor = '';
      input.style.opacity = '';
    }

    // Function to clear all output fields
    function clearOutputFields() {
      if (orgInput) {
        orgInput.value = '';
        orgInput.dispatchEvent(new Event('change'));
      }
      if (streetInput) {
        streetInput.value = '';
        streetInput.dispatchEvent(new Event('change'));
      }
      if (zipInput) {
        zipInput.value = '';
        zipInput.dispatchEvent(new Event('change'));
      }
      if (cityInput) {
        cityInput.value = '';
        cityInput.dispatchEvent(new Event('change'));
      }
    }

    // If "Make fields uneditable" is enabled, check when to make them uneditable
    // If "make_uneditable_after_population" is NOT ticked, make fields uneditable at load
    // If "make_uneditable_after_population" IS ticked, fields will be made uneditable after population
    if (makeFieldsUneditable && !makeUneditableAfterPopulation) {
      // Make all output fields uneditable immediately at load
      if (orgInput) setFieldUneditable(orgInput);
      if (streetInput) setFieldUneditable(streetInput);
      if (zipInput) setFieldUneditable(zipInput);
      if (cityInput) setFieldUneditable(cityInput);
    }

    // Wrap input so dropdown can position below
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';

    const parent = companyInput.parentNode;
    parent.insertBefore(wrapper, companyInput);
    wrapper.appendChild(companyInput);

    // Build dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'brreg-gf-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '999';
    dropdown.style.background = '#fff';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '6px';
    dropdown.style.display = 'none';
    dropdown.style.maxHeight = '220px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.marginTop = '4px';
    dropdown.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';

    wrapper.appendChild(dropdown);

    // Function to calculate and set dropdown width dynamically
    // This ensures we get accurate width even if calculated before input is fully rendered
    function updateDropdownWidth() {
      // Try multiple methods to get the input width
      let inputWidth = 0;
      
      // Method 1: offsetWidth (includes padding and border)
      if (companyInput.offsetWidth > 0) {
        inputWidth = companyInput.offsetWidth;
      }
      // Method 2: getBoundingClientRect (actual rendered width)
      else {
        const rect = companyInput.getBoundingClientRect();
        if (rect.width > 0) {
          inputWidth = rect.width;
        }
      }
      
      // Method 3: Try wrapper or parent container width
      if (inputWidth === 0 || inputWidth < 200) {
        const wrapperWidth = wrapper.offsetWidth || wrapper.getBoundingClientRect().width;
        if (wrapperWidth > 0) {
          inputWidth = wrapperWidth;
        }
      }
      
      // Method 4: Try parent container (Gravity Forms field wrapper)
      if (inputWidth === 0 || inputWidth < 200) {
        const parentEl = companyInput.closest('.gfield') || companyInput.closest('li');
        if (parentEl) {
          const parentWidth = parentEl.offsetWidth || parentEl.getBoundingClientRect().width;
          if (parentWidth > 0) {
            inputWidth = parentWidth;
          }
        }
      }
      
      // Ensure minimum width for usability (300px as you found works)
      const finalWidth = Math.max(inputWidth, 300);
      dropdown.style.width = finalWidth + 'px';
      
      return finalWidth;
    }

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

          // Update dropdown width before showing (recalculate in case layout changed)
          updateDropdownWidth();

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

              // Helper function to set value on field
              // Fields use readonly (not disabled) so values are submitted
              function setValueOnField(input, value) {
                if (!input) return;
                input.value = value;
                input.dispatchEvent(new Event('change'));
              }

              // Org number
              setValueOnField(orgInput, company.organisasjonsnummer);

              // Address fields
              const addr = getBestAddress(company);
              if (addr) {
                setValueOnField(streetInput, addr.street);
                setValueOnField(zipInput, addr.zip);
                setValueOnField(cityInput, addr.city);
              }

              // If "Make fields uneditable" is enabled AND "make_uneditable_after_population" is ticked,
              // make fields uneditable after population
              if (makeFieldsUneditable && makeUneditableAfterPopulation) {
                if (orgInput) setFieldUneditable(orgInput);
                if (streetInput) setFieldUneditable(streetInput);
                if (zipInput) setFieldUneditable(zipInput);
                if (cityInput) setFieldUneditable(cityInput);
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
      
      // If field is cleared (empty), clear output fields and make them editable again if needed
      if (term.length === 0) {
        clearOutputFields();
        
        // If "Make fields uneditable" is enabled AND "make_uneditable_after_population" is ticked,
        // make fields editable again when company name is cleared
        if (makeFieldsUneditable && makeUneditableAfterPopulation) {
          if (orgInput) setFieldEditable(orgInput);
          if (streetInput) setFieldEditable(streetInput);
          if (zipInput) setFieldEditable(zipInput);
          if (cityInput) setFieldEditable(cityInput);
        }
        
        dropdown.style.display = 'none';
        // Remove focus state when dropdown is hidden
        companyInput.style.borderColor = '';
        companyInput.style.boxShadow = '';
        return;
      }
      
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

