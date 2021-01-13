/*
  <auto-complete> component

  attributes:

    api       - API to call. e.g. https://myapi/search/${query} append the current value of the input with ID or name of "query"
    minlength - minimum number of characters to enter before an API search
    valid     - set to an error message to validate the entry

*/

class AutoComplete extends HTMLElement {

  static debounceDelay  = 500;          // input debounce delay
  static queryRegExp    = /\$\{(.+)\}/; // API query RegExp

  static componentCount = 0;            // components on page
  static cache          = {};           // cached API results


  constructor() {

    super();

    // unique component ID
    this.listId = `auto-complete-component-${ ++AutoComplete.componentCount }`;

    // initialize
    this.minlength = 1;

  }


  // component attributes
  static get observedAttributes() {

    return ['api', 'minlength', 'valid'];

  }


  // attribute change
  attributeChangedCallback(property, oldValue, newValue) {

    if (oldValue === newValue) return;
    this[property] = newValue;

    // get query field from API URL
    if (property === 'api') {

      const
        fq = String(this.api).match(AutoComplete.queryRegExp),
        q = fq && fq[1] && fq[1].trim();

      this.inputId = q || null;
      this.input = q && (document.getElementById(q) || document.querySelector(`[name=${q}]`));
      this.inputDataName = this.input && (this.input.dataset.name || q);

    }

    console.log('property', property, 'changed from', oldValue, 'to', newValue);

  }


  // initialize component
  connectedCallback() {

    if (!this.input) return;

    // initialize API cache
    AutoComplete.cache[this.api] = AutoComplete.cache[this.api] || {};
    this.apiData = AutoComplete.cache[this.api];

    // fetch inputs
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
      debounce = setTimeout(() => this.fetchMatches(e), AutoComplete.debounceDelay);

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
  fetchMatches() {

    const query = this.input.value;

    if (query.length < this.minlength || this.apiData[query] || query.toLowerCase().startsWith(String(this.currentQuery).toLowerCase())) {

      // use cached data
      this.datalistUpdate();
      return;

    }

    // fetch data
    this.apiData[query] = this.apiData[query] || {};
    const store = this.apiData[query];

    fetch(this.api.replace(AutoComplete.queryRegExp, query))
      .then(res => res.json())
      .then(data => {

        store.frag = document.createDocumentFragment();

        if (!data) return;

        // record data
        store.data = Array.isArray(data) ? data : [ data ];

        // create DOM fragment
        store.data.forEach(opt => {

          const value = opt[this.inputDataName];
          if (value) {
            const o = document.createElement('option');
            o.value = value;
            store.frag.appendChild(o);
          }

        });

        this.datalistUpdate();

      });

  }


  // update datalist from cache
  datalistUpdate() {

    const
      query = this.input.value,
      valid = this.validValue();

    // update datalist if required
    if (query.length < this.minlength) {

      // this.datalist.replaceChildren( document.createDocumentFragment() );
      this.currentQuery = null;

    }
    else if (!valid && !query.toLowerCase().startsWith(String(this.currentQuery).toLowerCase())) {

      this.datalist.replaceChildren( this.apiData[query].frag.cloneNode(true) );
      this.currentQuery = query;

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
    if (!query || !this.currentQuery) return null;

    return this.apiData[this.currentQuery].data.find(d => query === d[this.inputDataName]);

  }

}


// register component
window.customElements.define('auto-complete', AutoComplete);
