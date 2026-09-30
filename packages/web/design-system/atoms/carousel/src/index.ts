import { Carousel } from './component.js';
import { CarouselNext, CarouselPrev } from 'components/buttons/component.js';
import { CarouselDots } from './components/dots/index.js';
import { CarouselGallery } from './components/gallery/index.js';

// export 
export { CarouselNext, CarouselPrev } from 'components/buttons/component.js';
export { CarouselDots } from 'components/dots/index.js';
export { CarouselGallery } from './components/gallery/index.js';
export * from "./component";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

// the gallery first, the carousel looks for it
if (!window.customElements.get('pap-carousel-gallery'))
{
    window.customElements.define('pap-carousel-gallery', CarouselGallery);
}
if (!window.customElements.get('pap-carousel'))
{
    window.customElements.define('pap-carousel', Carousel);
}

// sub-components 
if (!window.customElements.get('pap-carousel-prev'))
{
    window.customElements.define('pap-carousel-prev', CarouselPrev);
}
if (!window.customElements.get('pap-carousel-next'))
{
    window.customElements.define('pap-carousel-next', CarouselNext);
}
if (!window.customElements.get('pap-carousel-dots'))
{
    window.customElements.define('pap-carousel-dots', CarouselDots);
}