// <auto-complete> component
class AutoComplete extends HTMLElement {

  static debounceDelay  = 500;          // input debounce delay
  static maxOptions     = 20;           // limit number of auto-complete options
  static queryRegExp    = /\$\{(.+)\}/; // API query RegExp

  static componentCount = 0;            // number of components on page
  static cache          = {};           // cached API results


  constructor() {
    super();

    // unique component ID
    this.listId = `auto-complete-component-${ ++AutoComplete.componentCount }`;
  }


  // component attributes
  static get observedAttributes() {
    return ['api', 'valid'];
  }


  // attribute change
  attributeChangedCallback(property, oldValue, newValue) {

    if (oldValue === newValue) return;
    this[property] = newValue;

    // get query field
    if (property === 'api') {

      const
        fq = String(this.api).match(AutoComplete.queryRegExp),
        q = fq && fq[1] && fq[1].trim();

      if (q) {
        this.inputId = q;
        this.input = document.getElementById(q) || document.querySelector(`[name=${q}]`);
        this.inputDataName = this.input && (this.input.dataset.name || q);
      }

    }

  }


  // initialize component
  connectedCallback() {

    if (!this.input) return;

    // initialize API cache
    AutoComplete.cache[this.api] = AutoComplete.cache[this.api] || {};
    this.apiData = AutoComplete.cache[this.api];

    // fetch all inputs
    this.allInputs = this.getElementsByTagName('input');

    // create linked <datalist>
    const dl = document.createElement('datalist');
    dl.id = this.listId;
    this.datalist = this.appendChild(dl);
    this.input.setAttribute('autocomplete', this.listId);
    this.input.setAttribute('list', this.listId);

    // attach debounded input event handler
    let debounce;
    this.inputHandler = e => {

      clearTimeout(debounce);
      debounce = setTimeout(() => this.apiFetch(e), AutoComplete.debounceDelay);

    };
    this.input.addEventListener('input', this.inputHandler);

    // check validity
    this.blurHandler = e => {

      if (!this.input || !this.valid) return;

      this.input.setCustomValidity(this.validValue() ? '' : this.valid);
      this.input.checkValidity();

    };
    this.input.addEventListener('blur', this.blurHandler);

  }


  // detach component
  disconnectedCallback() {

    if (!this.input) return;

    // remove event handlers
    this.input.removeEventListener('input', this.inputHandler);
    this.input.removeEventListener('blur', this.blurHandler);

    // remove datalist
    this.input.removeAttribute('list');
    this.datalist.remove();
    this.datalist = null;

  }


  // query API or fetch data from cache
  apiFetch() {

    const query = this.input.value;

    if (!query || this.apiData[query] || this.validValue()) {

      // reuse cached data
      this.datalistUpdate();
      return;

    }

    // call API for data
    this.apiData[query] = this.apiData[query] || {};

    fetch(this.api.replace(AutoComplete.queryRegExp, query))
      .then(res => res.json())
      .then(data => {

        if (!data) return;

        // record data
        data = Array.isArray(data) ? data : [data];
        this.apiData[query].data = data;

        // create DOM fragment
        this.apiData[query].frag = document.createDocumentFragment();
        this.apiData[query].chk = '';

        for (let d = 0, limit = AutoComplete.maxOptions; d < data.length && limit > 0; d++) {

          const value = data[d][this.inputDataName];
          if (value) {
            const o = document.createElement('option');
            o.value = value;
            this.apiData[query].frag.appendChild(o);
            this.apiData[query].chk += value;
          }

        }

        this.datalistUpdate();

      });

  }


  // update datalist from cache
  datalistUpdate() {

    const
      query = this.input.value,
      valid = this.validValue();

    if (!query) {

      // no query defined
      this.datalist.innerHTML = '';
      this.currentList = null;

    }
    else if (!valid && this.apiData[query] && (!this.currentList || this.currentList.chk != this.apiData[query].chk)) {

      // update datalist options
      this.currentList = this.apiData[query];
      this.datalist.replaceChildren(this.apiData[query].frag.cloneNode(true));

    }

    // update linked inputs
    Array.from(this.allInputs).forEach(i => {

      if (i === this.input) return;
      const name = i.dataset.name || i.name || i.id;
      if (name) i.value = valid && valid[name] ? valid[name] : '';

    });


  }


  // is query value valid?
  validValue() {

    const query = this.input && this.input.value.trim();
    if (!query || !this.currentList) return null;

    return this.currentList.data.find(d => query === d[this.inputDataName]);

  }

}


// register component
window.customElements.define('auto-complete', AutoComplete);
