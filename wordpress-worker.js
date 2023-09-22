/**
 * Worker Name: CloudFlare Image Resizing
 * Worker URI: https://github.com/Mecanik/cloudflare-image-resizing-worker
 * Description: This worker will replace Image URL's so you can use the CloudFlare Image Resizing service.
 * Version: 2.0.0
 * Author: Mecanik
 * Author URI: https://github.com/Mecanik/
 *
 * License: Apache License 2.0 (https://github.com/Mecanik/cloudflare-image-resizing-worker/blob/main/LICENSE)
 * Copyright (c) 2023 Mecanik
 **/

// Edit the below as needed
// START EDIT -----------------------------------------------------

/**
 * Multi-site support using the same Worker.
 * Define each domain you want to run through this Worker, each with their configurable options.
 * Using constants because for some unexplainable reason, Worker Enviroment Variables are not loading "sometimes".
 * If you want to remove an IMAGE option, simple set 'undefined'. For example: IMAGE_QUALITY: undefined.
*/
const SITES_CONFIG = [
    /*
	{
        DOMAIN: '...',
		REWRITE_LINK_TAGS: true, REWRITE_STYLE_TAGS: true, REWRITE_IMAGE_TAGS: true, REWRITE_HREF_TAGS: true, REWRITE_DIV_TAGS: true, REWRITE_SVG_TAGS: true,
		IMAGE_LAZY_LOAD: true, IMAGE_QUALITY: 90, IMAGE_FIT: 'crop', IMAGE_GRAVITY: 'auto', IMAGE_SHARPEN: 1, IMAGE_METADATA: 'none',
    },
	*/
	// Add more as needed
];

// END EDIT -------------------------------------------------------
// DO NOT EDIT BELOW THIS LINE. JUST STOP.
// IF YOU NEED ASSISTANCE, BOOK A CONSULTATION: https://mecanik.dev/en/consulting/

const DEFAULT_CONFIG = {
	
	// Self explanatory.
	REWRITE_LINK_TAGS: true,
	REWRITE_STYLE_TAGS: true,
	REWRITE_IMAGE_TAGS: true,
	REWRITE_HREF_TAGS: true,
	REWRITE_DIV_TAGS: true,
	REWRITE_SVG_TAGS: true,
	
	// Browser-level support for lazy loading images.
	// Browsers that do not support the loading attribute simply ignore it without side effects.
	IMAGE_LAZY_LOAD: true,
	
	// Quality determines the trade-off between image file size and visual quality.
	// Range 1-100
	IMAGE_QUALITY: 90, 
	
	// Resize method determines how the image should be scaled or cropped.
	// Only used when the width and height can be retrieved.
	// Values: 'scale-down', 'contain', 'cover', 'crop', 'pad'.
	IMAGE_FIT: 'crop',
	
	// When cropping with fit: "cover" and fit: "crop", this parameter defines the side or point that should not be cropped.
	// Mode 'auto' selects focal point based on saliency detection (using maximum symmetric surround algorithm)
	IMAGE_GRAVITY: 'auto',
	
	// Specifies strength of sharpening filter to apply to the image. 
	// The value is a floating-point number between 0 (no sharpening, default) and 10 (maximum). 
	// Note that 1 is a recommended value for downscaled images.
	// Range: 0 - 10
	IMAGE_SHARPEN: 1,
	
	// Controls amount of invisible metadata (EXIF data) that should be preserved. Color profiles and EXIF rotation are applied to the image even if the metadata is discarded. 
	// Note that if the Polish feature is enabled, all metadata may have been removed already and this option will have no effect.
	// Options: 'keep', 'copyright', 'none' 
	IMAGE_METADATA: 'none',
};

function getConfigForDomain(domain) {
	console.debug(`getConfigForDomain -> ${domain}`);
    return SITES_CONFIG.find(config => config.DOMAIN === domain) || DEFAULT_CONFIG;
}

const WidthAndHeight = '(?:-(\\d+)x(\\d)-\\d+?)|(?:-(\\d+)x(\\d+))';
const regexWidthAndHeight = new RegExp(`${WidthAndHeight}`, 'gi');

const WidthAndHeightInFilename = '-(\\d+)x(\\d+)(?=\\.\\w+$)';
const regexWidthAndHeightInFilename = new RegExp(`${WidthAndHeightInFilename}`);

const WidthDescriptor = '(\\d+)w$';
const regexWidthDescriptor = new RegExp(`${WidthDescriptor}`);

const Sizes = '(\\d+)x(\\d+)';
const regexSizes = new RegExp(`${Sizes}`, '');

const Src = '(https?:\\/\\/(?:www\\.|(?!www)).*?|\/\/.*?)(\\/wp-content\\/(?:uploads|plugins|themes)\\/.*?\\.(?:jpe?g|gif|png|webp|svg))(.*?)';
const rgxSrc = new RegExp(`${Src}`, 'g');

const SrcSet = '(https?:\\/\\/(?:www\\.|(?!www)).*?|\/\/.*?)(\\/wp-content\\/(?:uploads|plugins|themes)\\/.*?\\.(?:jpe?g|gif|png|webp|svg))(\\s(\\d+)w,?\\s?)';
const rgxSrcSet = new RegExp(`${SrcSet}`, 'g');

const Css = "url\\(['\"]?((?!\\/cdn-cgi\\/image\\/)(https?:\\/\\/(?:www\\.|(?!www))[^\\s]+?)?(\\/wp-content\\/(?:uploads|plugins|themes)\\/[^\\s]+?\\.(?:jpe?g|gif|png|webp|svg)))['\"]?\\)";
const rgxCss = new RegExp(`${Css}`, 'g');

const CssSpecial1 = '(?:url\\(\\"?\\\'?(\\/?images\\/.*?\\.(?:jpe?g|gif|png|webp|svg))(.*?)\\"?\\\'?\\))';
const rgxCssSpecial1 = new RegExp(`${CssSpecial1}`, 'g');

/**
 * Rewrites the <img> tags, including source sets, plugins like Revolution Slider and more.
 * @author Mecanik
 * @version 2.0.0
 */
class ImageTagRewriter extends HTMLRewriter 
{
	constructor(config) 
	{
		super();
        this.config = config;
    }

	async element(element) 
	{
		// If skip flag is true, exit early.
        if (this.config.REWRITE_IMAGE_TAGS === false) 
		{
			console.debug(`ImageTagRewriter -> ${this.config.REWRITE_IMAGE_TAGS} (skipping)`);
            return;
        }

		// This is a responsive image set
		if (element.hasAttribute("src") && element.hasAttribute("srcset")) 
		{
			// Process src
			const src = element.getAttribute("src");

			if (src && src.indexOf("base64") === -1 && src.indexOf(`/wp-content/`) !== -1 && src.indexOf('/cdn-cgi/image/') === -1) 
			{
				// Base CDN
				let CDN = "/cdn-cgi/image/";
				let width = element.getAttribute("width");
				let height = element.getAttribute("height");
				let hasSizes = !!width && !!height;

				// Check if image has sizes set and adjust CDN accordingly
				CDN += hasSizes ? `width=${width},height=${height},fit=${this.config.IMAGE_FIT},` : '';
				CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
				CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
				CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
				CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
				CDN += `format=auto,onerror=redirect`;
		
				let result = src.replace(rgxSrc, `$1${CDN}$2$3`);

				// Remove the sizes from the filename, pointing original image to Cloudflare for cropping
				if (hasSizes) {
					result = result.replace(regexWidthAndHeight, `$1`);
				}

				element.setAttribute("src", result);
			}

			// Now the srcset... this is a bit more complicated.
			const srcset = element.getAttribute("srcset");
			
			if (srcset && srcset.indexOf(`/wp-content/`) !== -1 && srcset.indexOf('/cdn-cgi/image/') === -1) 
			{
				// Split the srcset value into an array of image descriptors, using regex to split by comma possibly followed by space(s)
				let descriptors = srcset.split(/\s*,\s*/);

				// Iterate through the descriptors and modify each URL
				descriptors = descriptors.map(descriptor => {

					// Split on whitespace
					let parts = descriptor.trim().split(/\s+/);  

					// If unexpected format, return original descriptor
					if (parts.length !== 2) 
						return descriptor;

					// This should return us 2 parts: ["https://....Image-300x200.jpg", "300w"] 
					let url = parts[0];
					let width = parts[1];

					// Try to extract the width and height from the filename
					// If we fail, just fall back to the width descriptor
					let match;
					
					match = url.match(regexWidthAndHeightInFilename);

					if (match) 
					{
						let _width = match[1];
						let _height = match[2];
						
						// Base CDN
						let CDN = "/cdn-cgi/image/";
						CDN += `width=${_width},height=${_height},fit=${this.config.IMAGE_FIT},`;
						CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
						CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
						CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
						CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
						CDN += `format=auto,onerror=redirect`;
				
						// Insert our CDN URL
						url = url.replace(rgxSrc, `$1${CDN}$2$3`);

						// Remove the sizes from the filename, pointing original image to Cloudflare for cropping
						url = url.replace(regexWidthAndHeightInFilename, '');
					}
					else
					{
						// Extract width descriptor at the end, if filename did not contain dimensions
						match = width.match(regexWidthDescriptor);

						if (match) 
						{
							let _width = match[1];
							
							// Base CDN
							let CDN = "/cdn-cgi/image/";
							CDN += `width=${_width},`;
							CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
							CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
							CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
							CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
							CDN += `format=auto,onerror=redirect`;
					
							// Insert our CDN URL
							url = url.replace(rgxSrc, `$1${CDN}$2$3`);
						}
						else
						{
							// Well, everything is fucked. But we still point the image to Cloudflare!!!
							
							// Base CDN
							let CDN = "/cdn-cgi/image/";
							CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
							CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
							CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
							CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
							CDN += `format=auto,onerror=redirect`;
					
							// Insert our CDN URL
							url = url.replace(rgxSrc, `$1${CDN}$2$3`);
						}
					}

					// Reconstruct the descriptor
					return `${url} ${width}`;  
				});

				// Join the modified descriptors back into a string
				let modifiedSrcset = descriptors.join(', ');
				
				element.setAttribute("srcset", modifiedSrcset);
			}
		}
		// This is a normal image
		else if (element.hasAttribute("src") && !element.hasAttribute("srcset")) 
		{
			const src = element.getAttribute("src");

			if (src && src.indexOf("base64") === -1 && src.indexOf(`/wp-content/`) !== -1 && src.indexOf('/cdn-cgi/image/') === -1) 
			{
				// Base CDN
				let CDN = "/cdn-cgi/image/";
				let width = element.getAttribute("width");
				let height = element.getAttribute("height");
				let hasSizes = !!width && !!height;

				// Check if image has sizes set and adjust CDN accordingly
				CDN += hasSizes ? `width=${width},height=${height},fit=${this.config.IMAGE_FIT},` : '';
				CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
				CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
				CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
				CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
				CDN += `format=auto,onerror=redirect`;
			
				let result = src.replace(rgxSrc, `$1${CDN}$2$3`);

				// Remove the sizes from the filename, pointing original image to Cloudflare for cropping
				if (hasSizes) {
					result = result.replace(regexWidthAndHeight, `$1`);
				}

				element.setAttribute("src", result);
			}
		}

		// Extra
		const datasrc = element.getAttribute("data-src");

		if (datasrc && datasrc.indexOf("base64") === -1 && datasrc.indexOf(`/wp-content/`) !== -1 && datasrc.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			let width = element.getAttribute("width");
			let height = element.getAttribute("height");
			let hasSizes = !!width && !!height;

			// Check if image has sizes set and adjust CDN accordingly
			CDN += hasSizes ? `width=${width},height=${height},fit=${this.config.IMAGE_FIT},` : '';
			CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
			CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
			CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
			CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;
			
			let result = datasrc.replace(rgxSrc, `$1${CDN}$2$3`);

			// Remove the sizes from the filename, pointing original image to Cloudflare for cropping
			if (hasSizes) {
				result = result.replace(regexWidthAndHeight, `$1`);
			}

			element.setAttribute("data-src", result);
		}

		// Extra
		const datasrcset = element.getAttribute("data-srcset");

		if (datasrcset && datasrcset.indexOf(`/wp-content/`) !== -1 && datasrcset.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Split the datasrcset value into an array of image descriptors, using regex to split by comma possibly followed by space(s)
			let descriptors = datasrcset.split(/\s*,\s*/);

			// Iterate through the descriptors and modify each URL
			descriptors = descriptors.map(descriptor => {

			// Split on whitespace
			let parts = descriptor.trim().split(/\s+/);  

			// If unexpected format, return original descriptor
			if (parts.length !== 2) 
				return descriptor;

			// This should return us 2 parts: ["https://....Image-300x200.jpg", "300w"] 
			let url = parts[0];
			let width = parts[1];

			// Try to extract the width and height from the filename
			// If we fail, just fall back to the width descriptor
			let match;

			match = url.match(regexWidthAndHeightInFilename);

			if (match) 
			{
				let _width = match[1];
				let _height = match[2];

				// Base CDN
				let CDN = "/cdn-cgi/image/";
				CDN += `width=${_width},height=${_height},fit=${this.config.IMAGE_FIT},`;
				CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
				CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
				CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
				CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
				CDN += `format=auto,onerror=redirect`;

				// Insert our CDN URL
				url = url.replace(rgxSrc, `$1${CDN}$2$3`);

				// Remove the sizes from the filename, pointing original image to Cloudflare for cropping
				url = url.replace(regexWidthAndHeightInFilename, '');
			}
			else
			{
				// Extract width descriptor at the end, if filename did not contain dimensions
				match = width.match(regexWidthDescriptor);

				if (match) 
				{
					let _width = match[1];

					// Base CDN
					let CDN = "/cdn-cgi/image/";
					CDN += `width=${_width},`;
					CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
					CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
					CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
					CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
					CDN += `format=auto,onerror=redirect`;

					// Insert our CDN URL
					url = url.replace(rgxSrc, `$1${CDN}$2$3`);
				}
				else
				{
					// Well, everything is fucked. But we still point the image to Cloudflare!!!

					// Base CDN
					let CDN = "/cdn-cgi/image/";
					CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
					CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
					CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
					CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
					CDN += `format=auto,onerror=redirect`;

					// Insert our CDN URL
					url = url.replace(rgxSrc, `$1${CDN}$2$3`);
				}
			}

				// Reconstruct the descriptor
				return `${url} ${width}`;  
			});

			// Join the modified descriptors back into a string
			let modifiedSrcset = descriptors.join(', ');

			element.setAttribute("data-srcset", modifiedSrcset);
		}

		// Extra - handle "smart" plugins like Revolution Slider and other bananas
		const datalazyload = element.getAttribute("data-lazyload");

		if (datalazyload && datalazyload.indexOf("base64") === -1 && datalazyload.indexOf(`/wp-content/`) !== -1 && datalazyload.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			let width = element.getAttribute("width");
			let height = element.getAttribute("height");
			let hasSizes = !!width && !!height;

			// Check if image has sizes set and adjust CDN accordingly
			CDN += hasSizes ? `width=${width},height=${height},fit=${this.config.IMAGE_FIT},` : '';
			CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
			CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
			CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
			CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;
			
			let result = datalazyload.replace(rgxSrc, `$1${CDN}$2$3`);

			element.setAttribute("data-lazyload", result);
		}

		// Extra - handle "smart" plugins like WP Rocket and other bananas
		const datalazysrc = element.getAttribute("data-lazy-src");

		if (datalazysrc && datalazysrc.indexOf("base64") === -1 && datalazysrc.indexOf(`/wp-content/`) !== -1 && datalazysrc.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			let width = element.getAttribute("width");
			let height = element.getAttribute("height");
			let hasSizes = !!width && !!height;

			// Check if image has sizes set and adjust CDN accordingly
			CDN += hasSizes ? `width=${width},height=${height},fit=${this.config.IMAGE_FIT},` : '';
			CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
			CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
			CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
			CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;
			
			let result = datalazysrc.replace(rgxSrc, `$1${CDN}$2$3`);

			element.setAttribute("data-lazy-src", result);
		}

		// Extra - handle "smart" plugins like WP Rocket and other bananas
		const datalazysrcset = element.getAttribute("data-lazy-srcset");

		if (datalazysrcset && datalazysrcset.indexOf(`/wp-content/`) !== -1 && datalazysrcset.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Split the srcset value into an array of image descriptors, using regex to split by comma possibly followed by space(s)
			let descriptors = datalazysrcset.split(/\s*,\s*/);

			// Iterate through the descriptors and modify each URL
			descriptors = descriptors.map(descriptor => {

			// Split on whitespace
			let parts = descriptor.trim().split(/\s+/);  

			// If unexpected format, return original descriptor
			if (parts.length !== 2) 
				return descriptor;

			// This should return us 2 parts: ["https://....Image-300x200.jpg", "300w"] 
			let url = parts[0];
			let width = parts[1];

			// Try to extract the width and height from the filename
			// If we fail, just fall back to the width descriptor
			let match;

			match = url.match(regexWidthAndHeightInFilename);

			if (match) 
			{
				let _width = match[1];
				let _height = match[2];

				// Base CDN
				let CDN = "/cdn-cgi/image/";
				CDN += `width=${_width},height=${_height},fit=${this.config.IMAGE_FIT},`;
				CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
				CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
				CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
				CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
				CDN += `format=auto,onerror=redirect`;

				// Insert our CDN URL
				url = url.replace(rgxSrc, `$1${CDN}$2$3`);

				// Remove the sizes from the filename, pointing original image to Cloudflare for cropping
				url = url.replace(regexWidthAndHeightInFilename, '');
			}
			else
			{
				// Extract width descriptor at the end, if filename did not contain dimensions
				match = width.match(regexWidthDescriptor);

				if (match) 
				{
					let _width = match[1];

					// Base CDN
					let CDN = "/cdn-cgi/image/";
					CDN += `width=${_width},`;
					CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
					CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
					CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
					CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
					CDN += `format=auto,onerror=redirect`;

					// Insert our CDN URL
					url = url.replace(rgxSrc, `$1${CDN}$2$3`);
				}
				else
				{
					// Well, everything is fucked. But we still point the image to Cloudflare!!!

					// Base CDN
					let CDN = "/cdn-cgi/image/";
					CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
					CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
					CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
					CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
					CDN += `format=auto,onerror=redirect`;

					// Insert our CDN URL
					url = url.replace(rgxSrc, `$1${CDN}$2$3`);
				}
			}

				// Reconstruct the descriptor
				return `${url} ${width}`;  
			});

			// Join the modified descriptors back into a string
			let modifiedSrcset = descriptors.join(', ');

			element.setAttribute("data-lazy-srcset", modifiedSrcset);
		}
		
		// Lazy load
		if (!element.hasAttribute("loading") && this.config.IMAGE_LAZY_LOAD === true) 
		{
			element.setAttribute("loading", "lazy");
		}
	}
}

/**
 * Rewrites the <a> tags, mostly used by image viewers like lightbox
 * @author Mecanik
 * @version 2.0.0
 */
class HrefTagRewriter extends HTMLRewriter 
{
	constructor(config) 
	{
		super();
        this.config = config;
    }
	
	async element(element) 
	{
		// If skip flag is true, exit early.
        if (this.config.REWRITE_HREF_TAGS === false) 
		{
			console.debug(`HrefTagRewriter -> ${this.config.REWRITE_HREF_TAGS} (skipping)`);
            return;
        }
		
		if (element.hasAttribute("href")) 
		{
			const href = element.getAttribute("href");

			if (href && href.indexOf("base64") === -1 && href.indexOf(`/wp-content/`) !== -1 && href.indexOf('/cdn-cgi/image/') === -1) 
			{
				// Base CDN
				let CDN = "/cdn-cgi/image/";
				CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
				CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
				CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
				CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
				CDN += `format=auto,onerror=redirect`;

				let result = href.replace(rgxSrc, `$1${CDN}$2$3`);

				element.setAttribute("href", result);
			}
		}
	}
}

/**
 * Rewrites the <svg> tags, used to remove the empty svg's wordpress adds for no reason
 * @author Mecanik
 * @version 2.0.0
 */
class SvgTagRewriter extends HTMLRewriter 
{
	constructor(config) 
	{
		super();
        this.config = config;
    }
	
	async element(element) 
	{
		// If skip flag is true, exit early.
        if (this.config.REWRITE_SVG_TAGS === false) 
		{
			console.debug(`SvgTagRewriter -> ${this.config.REWRITE_SVG_TAGS} (skipping)`);
            return;
        }
		
		const viewBox = element.getAttribute("viewBox");
		const _class = element.getAttribute("class");
		const style = element.getAttribute("style");

		// Remove: https://github.com/WordPress/gutenberg/issues/38299
		// GG WP :)		
		if (viewBox && viewBox === "0 0 0 0" && !_class && style && style === "visibility: hidden; position: absolute; left: -9999px; overflow: hidden;") {
			element.remove();
		}
	}
}

/**
 * Rewrites the <style> tags, used to replace image sources for inline CSS
 * @author Mecanik
 * @version 2.0.0
 */
class StyleTagRewriter extends HTMLRewriter 
{
	constructor(config) 
	{
		super();
        this.buffer = "";
        this.transformedBuffer = "";
        this.config = config;
	}

	async text(inlineCSS) 
	{
		// If skip flag is true, exit early.
        if (this.config.REWRITE_STYLE_TAGS === false) 
		{
			console.debug(`StyleTagRewriter -> ${this.config.REWRITE_STYLE_TAGS} (skipping)`);
            return;
        }
		
		// Buffering the text content
		this.buffer += inlineCSS.text;

		// If this is the last chunk, process the buffered content
		if (inlineCSS.lastInTextNode) 
		{
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
			CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
			CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
			CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;

			let result = this.buffer.replace(rgxCss, `url('$2${CDN}$3')`);

			// Replace with the processed content
			inlineCSS.replace(result, { html: false });

			this.transformedBuffer = result.replace(/&gt;/g, '>');
		}
	}

    async element(element) {
        if (this.transformedBuffer) {
            element.setInnerContent(this.transformedBuffer, { html: true });
            this.buffer = "";
            this.transformedBuffer = "";
        }
    }
}

/**
 * Rewrites the <div> tags, used to replace image sources for inline CSS, plugins and more
 * @author Mecanik
 * @version 2.0.0
 */
class DivTagRewriter extends HTMLRewriter 
{
	constructor(config) 
	{
		super();
        this.config = config;
    }
	
	async element(element) 
	{
		// If skip flag is true, exit early.
        if (this.config.REWRITE_DIV_TAGS === false) 
		{
			console.debug(`DivTagRewriter -> ${this.config.REWRITE_DIV_TAGS} (skipping)`);
            return;
        }
		
		const style = element.getAttribute("style");

		if (style && style.indexOf("base64") === -1 && style.indexOf(`/wp-content/`) !== -1 && style.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
			CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
			CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
			CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;

			let result = style.replace(rgxCss, `url('$2${CDN}$3')`);

			element.setAttribute("style", result);
		}

		// Handle "smart" plugins like "Ultimate_VC_Addons"
		const bg = element.getAttribute("data-ultimate-bg");


		if (bg && bg.indexOf("base64") === -1 && bg.indexOf(`/wp-content/`) !== -1 && bg.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
			CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
			CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
			CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;

			let result = bg.replace(rgxSrc, `$1${CDN}$2$3`);

			element.setAttribute("data-ultimate-bg", result);
		}

		// Handle "smart" plugins like "Ultimate_VC_Addons"
		const dataimageid = element.getAttribute("data-image-id");

		if (dataimageid && dataimageid.indexOf("base64") === -1 && dataimageid.indexOf(`/wp-content/`) !== -1 && dataimageid.indexOf('/cdn-cgi/image/') === -1) 
		{
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
			CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
			CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
			CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;

			let result = bg.replace(rgxSrc, `$1${CDN}$2$3`);

			element.setAttribute("data-image-id", result);
		}
	}
}

/**
 * Rewrites the <link> tags, used to replace image sources for icons
 * @author Mecanik
 * @version 2.0.0
 */
class LinkTagRewriter extends HTMLRewriter 
{
	constructor(config) 
	{
		super();
        this.config = config;
    }
	
	async element(element) 
	{
		// If skip flag is true, exit early.
        if (this.config.REWRITE_LINK_TAGS === false) 
		{
			console.debug(`LinkTagRewriter -> ${this.config.REWRITE_LINK_TAGS} (skipping)`);
            return;
        }
		
		if (element.hasAttribute("rel")) 
		{
			const rel = element.getAttribute("rel");

			if (rel && rel === "shortcut icon" || rel === "icon" || rel === "apple-touch-icon" || rel === "apple-touch-icon-precomposed") 
			{
				// Base CDN
				let CDN = "/cdn-cgi/image/";
				let sizes = element.getAttribute("sizes");
				let matches = regexSizes.exec(sizes);
				let hasSizes = !!matches;

				// Check if image has sizes set and adjust CDN accordingly
				CDN += hasSizes ? `width=${matches[1]},height=${matches[2]},fit=${this.config.IMAGE_FIT},` : '';
				CDN += this.config.IMAGE_QUALITY ? `quality=${this.config.IMAGE_QUALITY},` : '';
				CDN += this.config.IMAGE_GRAVITY ? `gravity=${this.config.IMAGE_GRAVITY},` : '';
				CDN += this.config.IMAGE_SHARPEN ? `sharpen=${this.config.IMAGE_SHARPEN},` : '';
				CDN += this.config.IMAGE_METADATA ? `metadata=${this.config.IMAGE_METADATA},` : '';
				CDN += `format=auto,onerror=redirect`;
	
				const href = element.getAttribute("href");

				if (href && href.indexOf(`/wp-content/`) !== -1 && href.indexOf('/cdn-cgi/image/') === -1 && href.indexOf('.ico') === -1) 
				{
					let result = href.replace(rgxSrc, `$1${CDN}$2$3`);

					// Remove the sizes from the filename, pointing original image to Cloudflare for cropping
					if (hasSizes) {
						result = result.replace(regexWidthAndHeight, `$1`);
					}

					element.setAttribute("href", result);
				}			
			}
		}
	}
}

/**
 * Entry point for worker in module syntax
 * @author Mecanik
 * @version 2.0.0
 */
export default {
	async fetch(request, env, ctx) {

		// If an error occurs, do not break the site, just continue
		ctx.passThroughOnException();

		// We need to fetch the origin full response.
		const originResponse = await fetch(request);

		if (originResponse.status !== 200) {
			console.error(`Invalid Origin HTTP Status: ${originResponse.status}`);
			return originResponse;
		}

		const {
			origin,
			pathname,
			hostname
		} = new URL(request.url);

		// Do not rewrite images inside these paths (save some cost?)
		if (pathname.indexOf("/wp-admin/") !== -1 || pathname.indexOf("/wp-login/") !== -1) {
			console.error(`Bypassing page by path: ${pathname}`);
			return originResponse;
		}

		// If the content type is HTML, we will run the rewriter
		// If running APO this is not returned once the page is cached on the Edge servers.
		const contentType = originResponse.headers.get("content-type");

		if (contentType === null) {
			console.error(`Missing Content Type: ${contentType}`);
			return originResponse;
		}

		if (contentType.startsWith("text/html")) 
		{
			const domain = hostname.toLowerCase();
			const currentConfig = getConfigForDomain(domain);

			let newResponse = new HTMLRewriter()
				.on('link', new LinkTagRewriter(currentConfig))
				.on('style', new StyleTagRewriter(currentConfig))
				.on('img', new ImageTagRewriter(currentConfig))
				.on('a', new HrefTagRewriter(currentConfig))
				.on('svg', new SvgTagRewriter(currentConfig))
				.on('div', new DivTagRewriter(currentConfig))
				.transform(originResponse);

			return newResponse;
		}
		// Trick or Treat? We replace images inside ALL CSS files you have :)
		else if (contentType.startsWith("text/css")) 
		{
			const domain = hostname.toLowerCase();
			const currentConfig = getConfigForDomain(domain);
			
			// Base CDN
			let CDN = "/cdn-cgi/image/";
			CDN += currentConfig.IMAGE_QUALITY ? `quality=${currentConfig.IMAGE_QUALITY},` : '';
			CDN += currentConfig.IMAGE_GRAVITY ? `gravity=${currentConfig.IMAGE_GRAVITY},` : '';
			CDN += currentConfig.IMAGE_SHARPEN ? `sharpen=${currentConfig.IMAGE_SHARPEN},` : '';
			CDN += currentConfig.IMAGE_METADATA ? `metadata=${currentConfig.IMAGE_METADATA},` : '';
			CDN += `format=auto,onerror=redirect`;
				
			const originalBody = await originResponse.text();

			let result = originalBody.replace(rgxCss, `url('$2${CDN}$3')`);

			const response = new Response(result, {
				headers: originResponse.headers,
			});

			return response;

		} else {
			console.error(`Invalid Content Type: ${contentType}`);
			return originResponse;
		}
	}
}