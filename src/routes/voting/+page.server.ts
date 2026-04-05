import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const session = locals.session;

	// Fetch active voting period
	const { data: periods } = await supabase
		.from('voting_periods')
		.select('*')
		.eq('is_active', true)
		.order('end_time', { ascending: true })
		.limit(1);

	const activePeriod = periods?.[0] || null;
	const isVotingOpen = activePeriod && new Date(activePeriod.end_time) > new Date();

	// Fetch designs with vote counts
	const { data: designs } = await supabase
		.from('accurate_design_votes')
		.select('id, title, vote_count, image_url')
		.order('id');

	// Fetch user's votes
	let userVotes: number[] = [];
	if (session?.user) {
		const { data: votes } = await supabase.rpc('get_user_votes', {
			p_user_id: session.user.id
		});
		userVotes = (votes || []).map((v: { design_id: number }) => v.design_id);
	}

	return {
		period: activePeriod,
		isVotingOpen,
		designs: designs || [],
		userVotes,
		maxVotes: activePeriod?.max_votes_per_user || 5
	};
};
