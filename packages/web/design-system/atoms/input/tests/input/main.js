import '@papit/input';

// fixture-only: count implicit submissions instead of navigating
const submitform = document.querySelector('[data-testid="submit-form"]');
submitform.submitcount = 0;
submitform.addEventListener('submit', e => {
    e.preventDefault();
    submitform.submitcount++;
});
