import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const session = locals.session;

	// Edition config — change this for new editions
	const edition = {
		title: "Jan & Feb 26'",
		pageCount: 13,
		folder: '/January',
		downloadPageIndex: 12,
		bookPageIndex: 7,
		patternLink: 'https://drive.google.com/drive/folders/PATTERN_FOLDER_ID?usp=sharing',
		diyLink: 'https://drive.google.com/drive/folders/DIY_FOLDER_ID?usp=sharing'
	};

	const pages = Array.from({ length: edition.pageCount }, (_, i) => ({
		index: i,
		src: `${edition.folder}/${i + 1}.webp`
	}));

	// Fetch comments + likes in parallel
	const [commentsRes, likesRes] = await Promise.all([
		supabase
			.from('comments')
			.select('*, profiles:profiles(username)')
			.order('created_at', { ascending: true }),
		supabase
			.from('likes')
			.select('*')
			.order('created_at', { ascending: true })
	]);

	// Group comments by page
	const commentsByPage: Record<number, Array<{ id: string; content: string; username: string; created_at: string }>> = {};
	for (const c of commentsRes.data || []) {
		const pg = c.page_index;
		if (!commentsByPage[pg]) commentsByPage[pg] = [];
		commentsByPage[pg].push({
			id: c.id,
			content: c.content,
			username: (c.profiles as any)?.username || 'Anonymous',
			created_at: c.created_at || ''
		});
	}

	// Group likes by page + check user likes
	const likesByPage: Record<number, number> = {};
	const userLikes: Record<number, string> = {}; // page -> like_id
	for (const l of likesRes.data || []) {
		likesByPage[l.page_index] = (likesByPage[l.page_index] || 0) + 1;
		if (session?.user && l.user_id === session.user.id) {
			userLikes[l.page_index] = l.id;
		}
	}

	return {
		edition,
		pages,
		commentsByPage,
		likesByPage,
		userLikes
	};
};
