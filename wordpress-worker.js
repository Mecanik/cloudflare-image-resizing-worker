/**
 * Worker Name: CloudFlare Image Resizing
 * Worker URI: https://github.com/Mecanik/cloudflare-image-resizing-worker
 * Description: This worker will replace Image URL's so you can use the CloudFlare Image Resizing service.
 * Version: 1.0
 * Author: Mecanik
 * Author URI: https://github.com/Mecanik/
 *
 * License: Apache License 2.0 (https://github.com/Mecanik/cloudflare-image-resizing-worker/blob/main/LICENSE)
 * Copyright (c) 2023 Mecanik
 **/

// Edit the below as needed
// START EDIT -----------------------------------------------------

// Set the image quality
const IMAGE_QUALITY = 90;

// Append lazy loading to images
const IMAGE_LAZY_LOAD = true;

// END EDIT -------------------------------------------------------
// DO NOT EDIT BELOW THIS LINE.

const WidthAndHeight = '(?:-(\\d+)x(\\d)-\\d+?)|(?:-(\\d+)x(\\d+))';
const regexWidthAndHeight = new RegExp(`${WidthAndHeight}`, 'gi');

const Sizes = '(\\d+)x(\\d+)';
const regexSizes = new RegExp(`${Sizes}`, '');

const Src = '(https?:\\/\\/(?:www\\.|(?!www)).*?|\/\/.*?)(\\/wp-content\\/(?:uploads|plugins|themes)\\/.*?\\.(?:jpe?g|gif|png|webp|svg))(.*?)';
const rgxSrc = new RegExp(`${Src}`, 'g');

const SrcSet = '(https?:\\/\\/(?:www\\.|(?!www)).*?|\/\/.*?)(\\/wp-content\\/(?:uploads|plugins|themes)\\/.*?\\.(?:jpe?g|gif|png|webp|svg))(\\s(\\d+)w,?\\s?)';
const rgxSrcSet = new RegExp(`${SrcSet}`, 'g');

const Css = '(?:url\\(\\"?\\\'?(https?:\\/\\/(?:www\\\\\\\\.|(?!www)).*?|\/\/.*?)(\\/wp-content\\/(?:uploads|plugins|themes)\\/.*?\\.(?:jpe?g|gif|png|webp|svg))(.*?)\\"?\\\'?\\))';
const rgxCss = new RegExp(`${Css}`, 'g');

const CssSpecial1 = '(?:url\\(\\"?\\\'?(\\/?images\\/.*?\\.(?:jpe?g|gif|png|webp|svg))(.*?)\\"?\\\'?\\))';
const rgxCssSpecial1 = new RegExp(`${CssSpecial1}`, 'g');

/**
 * Rewrites the <img> tags, including source sets, plugins like Revolution Slider and more.
 * @author Mecanik
 * @version 1.0.0
 */
class ImageTagRewriter extends HTMLRewriter {
	async element(element) {

		// Base CDN
		let CDN = "/cdn-cgi/image/";
		let hasSizes = false;

		// Check if image has sizes set
		if (element.hasAttribute("width") && element.hasAttribute("height")) {
			const width = element.getAttribute("width");

			if (width) {
				CDN += "width=" + width + ",";
			}

			const height = element.getAttribute("height");

			if (height) {
				CDN += "height=" + height + ",";
			}

			if (width && height)
				hasSizes = true;
		}

		// This is a responsive image set
		if (element.hasAttribute("src") && element.hasAttribute("srcset")) {

			// Process src
			const src = element.getAttribute("src");

			if (src && src.indexOf("base64") === -1) {
				if (src.indexOf(`/wp-content/`) !== -1 && src.indexOf('/cdn-cgi/image/') === -1) {
					let result = src.replace(rgxSrc, `$1${CDN}$2$3`);

					if (hasSizes) {
						result = result.replace(regexWidthAndHeight, `$1`);
					}

					element.setAttribute("src", result);
				}
			}

			// Now the srcset
			const srcset = element.getAttribute("srcset");

			if (srcset) {
				if (srcset.indexOf(`/wp-content/`) !== -1 && srcset.indexOf('/cdn-cgi/image/') === -1) {
					const result = srcset.replace(rgxSrcSet, `$1/cdn-cgi/image/width=$4,quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none$2$3`);

					element.setAttribute("srcset", result);
				}
			}
		}
		// This is a normal image
		else if (element.hasAttribute("src") && !element.hasAttribute("srcset")) {

			// Add options
			if (hasSizes)
				CDN += `fit=crop,quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;
			else
				CDN += `quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

			const src = element.getAttribute("src");

			if (src && src.indexOf("base64") === -1) {
				if (src.indexOf(`/wp-content/`) !== -1 && src.indexOf('/cdn-cgi/image/') === -1) {
					let result = src.replace(rgxSrc, `$1${CDN}$2$3`);

					// Remove the sizes from the filename, pointing original image to Cloudflare for resizing
					if (hasSizes) {
						result = result.replace(regexWidthAndHeight, `$1`);
					}

					element.setAttribute("src", result);
				}
			}
		}

		// Extra
		const datasrc = element.getAttribute("data-src");

		if (datasrc && datasrc.indexOf("base64") === -1) {
			if (datasrc.indexOf(`/wp-content/`) !== -1 && datasrc.indexOf('/cdn-cgi/image/') === -1) {
				let result = datasrc.replace(rgxSrc, `$1${CDN}$2$3`);

				if (hasSizes) {
					result = result.replace(regexWidthAndHeight, `$1`);
				}

				element.setAttribute("data-src", result);
			}
		}

		// Extra
		const datasrcset = element.getAttribute("data-srcset");

		if (datasrcset) {
			if (datasrcset.indexOf(`/wp-content/`) !== -1 && datasrcset.indexOf('/cdn-cgi/image/') === -1) {
				const result = datasrcset.replace(rgxSrcSet, `$1/cdn-cgi/image/width=$4,quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none$2$3`);

				element.setAttribute("data-srcset", result);
			}
		}

		// Extra - handle "smart" plugins like Revolution Slider and other bananas
		const datalazyload = element.getAttribute("data-lazyload");

		if (datalazyload) {
			if (datalazyload.indexOf(`/wp-content/`) !== -1 && datalazyload.indexOf('/cdn-cgi/image/') === -1) {
				let result = datalazyload.replace(rgxSrc, `$1${CDN}$2$3`);

				element.setAttribute("data-lazyload", result);
			}
		}

		// Extra - handle "smart" plugins like WP Rocket and other bananas
		const datalazysrc = element.getAttribute("data-lazy-src");

		if (datalazysrc) {
			if (datalazysrc.indexOf(`/wp-content/`) !== -1 && datalazysrc.indexOf('/cdn-cgi/image/') === -1) {
				let result = datalazysrc.replace(rgxSrc, `$1${CDN}$2$3`);

				element.setAttribute("data-lazy-src", result);
			}
		}

		// Extra - handle "smart" plugins like WP Rocket and other bananas
		const datalazysrcset = element.getAttribute("data-lazy-srcset");

		if (datalazysrcset) {
			if (datalazysrcset.indexOf(`/wp-content/`) !== -1 && datalazysrcset.indexOf('/cdn-cgi/image/') === -1) {
				let result = datalazysrcset.replace(rgxSrc, `$1${CDN}$2$3`);

				element.setAttribute("data-lazy-srcset", result);
			}
		}
		
		// Lazy load
		if (!element.hasAttribute("loading") && IMAGE_LAZY_LOAD === true) {
			element.setAttribute("loading", "lazy");
		}
	}
}

/**
 * Rewrites the <a> tags, mostly used by image viewers like lightbox
 * @author Mecanik
 * @version 1.0.0
 */
class HrefTagRewriter extends HTMLRewriter {
	async element(element) {
		if (element.hasAttribute("href")) {
			const href = element.getAttribute("href");

			if (href) {
				if (href.indexOf(`/wp-content/`) !== -1 && href.indexOf('/cdn-cgi/image/') === -1) {
					const CDN = `/cdn-cgi/image/quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

					let result = href.replace(rgxSrc, `$1${CDN}$2$3`);

					element.setAttribute("href", result);
				}
			}
		}
	}
}

/**
 * Rewrites the <svg> tags, used to remove the empty svg's wordpress adds for no reason
 * @author Mecanik
 * @version 1.0.0
 */
class SvgTagRewriter extends HTMLRewriter {
	async element(element) {
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
 * @version 1.0.0
 */
class StyleTagRewriter extends HTMLRewriter {
	constructor() {
		super();
		this.buffer = "";
	}

	async text(inlineCSS) {
		this.buffer += inlineCSS.text;

		// We must save the text chunk into the buffer... thanks CF.
		if (this.buffer && inlineCSS.lastInTextNode) {
			const CDN = `/cdn-cgi/image/quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

			let result = this.buffer.replace(rgxCss, `url('$1${CDN}$2$3')`);

			inlineCSS.replace(result);
			this.buffer = "";
		} else {
			// Remove the text/style which we already saved into the buffer
			inlineCSS.remove();
		}
	}
}

/**
 * Rewrites the <div> tags, used to replace image sources for inline CSS, plugins and more
 * @author Mecanik
 * @version 1.0.0
 */
class DivTagRewriter extends HTMLRewriter {
	async element(element) {
		if (element.hasAttribute("style")) {
			const style = element.getAttribute("style");

			if (style) {
				if (style.indexOf(`/wp-content/`) !== -1 && style.indexOf('/cdn-cgi/image/') === -1) {
					const CDN = `/cdn-cgi/image/quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

					let result = style.replace(rgxSrc, `url('$1${CDN}$2$3')`);

					element.setAttribute("style", result);
				}
			}
		}

		// Handle "smart" plugins like "Ultimate_VC_Addons"
		if (element.hasAttribute("data-ultimate-bg")) {
			const bg = element.getAttribute("data-ultimate-bg");

			if (bg) {
				if (bg.indexOf(`/wp-content/`) !== -1 && bg.indexOf('/cdn-cgi/image/') === -1) {
					const CDN = `/cdn-cgi/image/quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

					let result = bg.replace(rgxSrc, `url('$1${CDN}$2$3')`);

					element.setAttribute("data-ultimate-bg", result);
				}
			}
		}

		// Handle "smart" plugins like "Ultimate_VC_Addons"
		if (element.hasAttribute("data-image-id")) {
			const dataimageid = element.getAttribute("data-image-id");

			if (dataimageid) {
				if (dataimageid.indexOf(`/wp-content/`) !== -1 && dataimageid.indexOf('/cdn-cgi/image/') === -1) {
					const CDN = `/cdn-cgi/image/quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

					let result = dataimageid.replace(rgxSrc, `url('$1${CDN}$2$3')`);

					element.setAttribute("data-image-id", result);
				}
			}
		}
	}
}

/**
 * Rewrites the <link> tags, used to replace image sources for icons
 * @author Mecanik
 * @version 1.0.0
 */
class LinkTagRewriter extends HTMLRewriter {
	async element(element) {
		if (element.hasAttribute("rel")) {
			const rel = element.getAttribute("rel");

			if (rel) {
				if (rel === "shortcut icon" || rel === "icon" || rel === "apple-touch-icon" || rel === "apple-touch-icon-precomposed") {
					// Base CDN
					let CDN = "/cdn-cgi/image/";
					let hasSizes = false;

					// Check if image has sizes set
					if (element.hasAttribute("sizes")) {
						const sizes = element.getAttribute("sizes");

						if (sizes) {
							let m;
							if ((m = regexSizes.exec(sizes)) !== null) {
								CDN += `width=${m[1]},height=${m[2]},`;
								hasSizes = true;
							}
						}
					}

					// Add options
					if (hasSizes)
						CDN += `fit=crop,quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;
					else
						CDN += `quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

					const href = element.getAttribute("href");

					if (href) {
						if (href.indexOf(`/wp-content/`) !== -1 && href.indexOf('/cdn-cgi/image/') === -1 && href.indexOf('.ico') === -1) {
							let result = href.replace(rgxSrc, `$1${CDN}$2$3`);

							// Remove the sizes from the filename, pointing original image to Cloudflare for resizing
							if (hasSizes) {
								result = result.replace(regexWidthAndHeight, `$1`);
							}

							element.setAttribute("href", result);
						}
					}
				}
			}
		}
	}
}

/**
 * Entry point for worker in module syntax
 * @author Mecanik
 * @version 1.0.0
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
			pathname
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

		if (contentType.startsWith("text/html")) {
			let newResponse = new HTMLRewriter()
				.on('link', new LinkTagRewriter())
				.on('style', new StyleTagRewriter())
				.on('img', new ImageTagRewriter())
				.on('a', new HrefTagRewriter())
				.on('svg', new SvgTagRewriter())
				.on('div', new DivTagRewriter())
				.transform(originResponse);

			return newResponse;
		}
		// Trick or Treat? We replace images inside ALL CSS files you have :)
		else if (contentType.startsWith("text/css")) {
			let response = new Response(originResponse.body, {
				headers: originResponse.headers,
			});

			const originalBody = await originResponse.text();

			// First we take care of proper CSS made by proper themes
			// Which have full canonical URL for the images
			const CDN = `/cdn-cgi/image/quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none`;

			let result = originalBody.replace(rgxCss, `url('$1${CDN}$2$3')`);

			// Here we check if the image is referenced from a folder inside the template
			// For example, the CSS might reference url(images/cat.jpg) = which resides in .../wp-content/themes/petsworld/...
			if (result.indexOf("images/") !== -1) {
				// Here we use the path name where the CSS resides and extract the image path
				// For example the CSS is inside /wp-content/themes/petsworld/style.css
				// We then use /wp-content/themes/petsworld/ as the image path
				const path = pathname.substring(0, pathname.lastIndexOf('/')) + "/";

				// The resulting replacement will be something like:
				// .../cdn-cgi/image/quality=90,format=auto,onerror=redirect,metadata=none/wp-content/themes/petsworld/images/cat.jpg
				const CDN = `${origin}/cdn-cgi/image/quality=${IMAGE_QUALITY},format=auto,onerror=redirect,metadata=none${path}`;

				const body = result.replace(rgxCssSpecial1, `url('${CDN}$1$2')`);

				response = new Response(body, response);
				return response;
			}

			response = new Response(result, response);
			return response;

		} else {
			console.error(`Invalid Content Type: ${contentType}`);
			return originResponse;
		}
	}
}