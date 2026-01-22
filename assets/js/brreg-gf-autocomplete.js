(function () {
  // Safety: config must exist
  if (typeof BrregGFConfig === 'undefined' || !BrregGFConfig.profiles) {
    console.warn('[BrregGF] No config found (BrregGFConfig).');
    return;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Init immediately, then watch DOM changes (GF/Beaver async rendering, multi-page forms, etc.)
    initForAllProfiles();

    // IMPORTANT: Do not disconnect after first init.
    // Pages can contain multiple forms, and some fields/forms may be injected later.
    const observer = new MutationObserver(function () {
      initForAllProfiles();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      // Multi-page GF often toggles visibility via class/style changes,
      // without inserting/removing nodes. Observe attributes so we re-init
      // when page 2/3 becomes visible.
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
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

    // Gravity Forms can render multiple forms on the same page.
    // We must scope lookup of outputs to the same form wrapper as the trigger input.
    const wrappers = Array.prototype.slice.call(document.querySelectorAll('.gform_wrapper'));
    const roots = wrappers.length ? wrappers : [document];

    let anyInitialized = false;

    roots.forEach(function (root) {
      const companyInputs = findInputsByWrapperClass(triggerClass, root);
      if (!companyInputs.length) {
        return;
      }

      companyInputs.forEach(function (companyInput) {
        // Avoid rebinding
        if (companyInput.dataset.brregBound === '1') {
          anyInitialized = true;
          return;
        }
        companyInput.dataset.brregBound = '1';

        console.log(
          '[BrregGF] Initializing profile:',
          profile.id || 'unnamed',
          'on field with class',
          triggerClass
        );

        // Resolve output fields via CSS class (scoped to same root wrapper)
        const orgInput = outputs.orgnr ? findInputByWrapperClass(outputs.orgnr, root) : null;
        const streetInput = outputs.street ? findInputByWrapperClass(outputs.street, root) : null;
        const zipInput = outputs.zip ? findInputByWrapperClass(outputs.zip, root) : null;
        const cityInput = outputs.city ? findInputByWrapperClass(outputs.city, root) : null;
        const emailInput = outputs.email ? findInputByWrapperClass(outputs.email, root) : null;

        // Per-field settings for uneditable control
        const fieldSettings = profile.field_settings || {};

        // Helper function to check if a field should be uneditable
        function shouldBeUneditable(fieldKey) {
          const setting = fieldSettings[fieldKey];
          if (!setting) return false;
          return setting.uneditable === true || setting.uneditable === '1' || setting.uneditable === 1;
        }

        // Helper function to check if a field should be uneditable only after population
        function shouldBeUneditableAfterPopulation(fieldKey) {
          const setting = fieldSettings[fieldKey];
          if (!setting) return false;
          return setting.uneditable_after_population === true || setting.uneditable_after_population === '1' || setting.uneditable_after_population === 1;
        }

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
          if (emailInput) {
            emailInput.value = '';
            emailInput.dispatchEvent(new Event('change'));
          }
        }

        // Make fields uneditable at page load if configured
        // Only apply if "uneditable" is checked but "uneditable_after_population" is NOT checked
        if (orgInput && shouldBeUneditable('orgnr') && !shouldBeUneditableAfterPopulation('orgnr')) {
          setFieldUneditable(orgInput);
        }
        if (streetInput && shouldBeUneditable('street') && !shouldBeUneditableAfterPopulation('street')) {
          setFieldUneditable(streetInput);
        }
        if (zipInput && shouldBeUneditable('zip') && !shouldBeUneditableAfterPopulation('zip')) {
          setFieldUneditable(zipInput);
        }
        if (cityInput && shouldBeUneditable('city') && !shouldBeUneditableAfterPopulation('city')) {
          setFieldUneditable(cityInput);
        }
        if (emailInput && shouldBeUneditable('email') && !shouldBeUneditableAfterPopulation('email')) {
          setFieldUneditable(emailInput);
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

          const street = Array.isArray(addr.adresse) ? addr.adresse.join(', ') : addr.adresse || '';

          return {
            street: street || '',
            zip: addr.postnummer || '',
            city: addr.poststed || '',
          };
        }

        function fetchCompanies(searchTerm) {
          const url =
            'https://data.brreg.no/enhetsregisteret/api/enheter?navn=' +
            encodeURIComponent(searchTerm) +
            '&size=10';

          fetch(url)
            .then(function (response) {
              return response.json();
            })
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

                  // Email field - uses company.epostadresse from Brreg API
                  setValueOnField(emailInput, company.epostadresse || '');

                  // Make fields uneditable after population if configured
                  // Only apply if both "uneditable" and "uneditable_after_population" are checked
                  if (orgInput && shouldBeUneditable('orgnr') && shouldBeUneditableAfterPopulation('orgnr')) {
                    setFieldUneditable(orgInput);
                  }
                  if (streetInput && shouldBeUneditable('street') && shouldBeUneditableAfterPopulation('street')) {
                    setFieldUneditable(streetInput);
                  }
                  if (zipInput && shouldBeUneditable('zip') && shouldBeUneditableAfterPopulation('zip')) {
                    setFieldUneditable(zipInput);
                  }
                  if (cityInput && shouldBeUneditable('city') && shouldBeUneditableAfterPopulation('city')) {
                    setFieldUneditable(cityInput);
                  }
                  if (emailInput && shouldBeUneditable('email') && shouldBeUneditableAfterPopulation('email')) {
                    setFieldUneditable(emailInput);
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

            // Make fields editable again when company name is cleared
            // Only apply if both "uneditable" and "uneditable_after_population" are checked
            if (orgInput && shouldBeUneditable('orgnr') && shouldBeUneditableAfterPopulation('orgnr')) {
              setFieldEditable(orgInput);
            }
            if (streetInput && shouldBeUneditable('street') && shouldBeUneditableAfterPopulation('street')) {
              setFieldEditable(streetInput);
            }
            if (zipInput && shouldBeUneditable('zip') && shouldBeUneditableAfterPopulation('zip')) {
              setFieldEditable(zipInput);
            }
            if (cityInput && shouldBeUneditable('city') && shouldBeUneditableAfterPopulation('city')) {
              setFieldEditable(cityInput);
            }
            if (emailInput && shouldBeUneditable('email') && shouldBeUneditableAfterPopulation('email')) {
              setFieldEditable(emailInput);
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

        anyInitialized = true;
      });
    });

    return anyInitialized;
  }

  /**
   * Utility: find Gravity Forms input via wrapper CSS class
   * Assumes structure like <li class="... custom-class ..."><input ...></li>
   */
  function findInputByWrapperClass(cssClass, root) {
    if (!cssClass) return null;
    const scope = root || document;

    // Typical GF markup: .customclass input (scoped to a gform wrapper/root)
    let el = scope.querySelector('.' + cssClass + ' input');
    if (el) {
      return el;
    }

    // Fallback: if someone applied class directly on input
    el = scope.querySelector('input.' + cssClass);
    if (el) {
      return el;
    }

    return null;
  }

  function findInputsByWrapperClass(cssClass, root) {
    if (!cssClass) return [];
    const scope = root || document;
    return Array.prototype.slice.call(scope.querySelectorAll('.' + cssClass + ' input, input.' + cssClass));
  }

})();

