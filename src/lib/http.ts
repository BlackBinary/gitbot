import fetch from 'node-fetch';

const fetchPage = async (url: string): Promise<string> => {
	try {
		const response = await fetch(url, {
			redirect: 'follow',
			follow: 10,
		});
		const body = await response.text();
		return body;
	} catch (error) {
		console.log('error fetching page', error);
		return '';
	}
};

const extractHrefsFromHtml = (htmlContent: string): Set<string> => {
	const hrefRegex = /href="(.+?)"/g;
	const hrefs = new Set<string>();
	let match;
	while ((match = hrefRegex.exec(htmlContent)) !== null) {
		if (!match[1].startsWith('http')) {
			continue;
		}

		try {
			const currentUrl = new URL(match[1]);
			currentUrl.hash = '';
			currentUrl.search = '';
			hrefs.add(currentUrl.toString());
		} catch (error) {
			console.log('error parsing url', error);
		}
	}

	return hrefs;
};

const makeBaseUrl = (hostname: string, type: 'http' | 'https'): string => `${type}://${hostname}`;

const makeGitUrl = (url: string): string => {
	const gitUrl = new URL('/.git/config', url);
	return gitUrl.toString();
};

const checkGit = async (domain: string): Promise<string[]> => {
	const httpDomain = makeBaseUrl(domain, 'http');
	const httpsDomain = makeBaseUrl(domain, 'https');
	const httpGitUrl = makeGitUrl(httpDomain);
	const httpsGitUrl = makeGitUrl(httpsDomain);

	const responses = await Promise.allSettled([
		httpsGitUrl,
		httpGitUrl,
	].map(async url => {
		try {
			const response = await fetch(url);
			if (response.status === 200) {
				if (response.url === url) {
					console.log(`[INFO] Git found at ${url}`);
					return url;
				}

				return '';
			}
		} catch (error) {
			console.log('error fetching page', error);
			return '';
		}
	}));

	return responses.filter(response => response.status === 'fulfilled').map(response => response.value).filter(Boolean) as string[];
};

export default {
	checkGit,
	fetchPage,
	extractHrefsFromHtml,
};
