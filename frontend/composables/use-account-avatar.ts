export function useAccountAvatar() {
  const api = useUserApi();
  const userId = useAuthContext().user?.id;
  const images = useState<Record<string, string>>(
    "account-avatars",
    () => ({}),
  );
  const image = computed(() => (userId ? images.value[userId] || "" : ""));
  const revisions = useState<Record<string, number>>(
    "account-avatar-revisions",
    () => ({}),
  );

  async function refreshAvatar() {
    if (!userId) return;
    const revision = revisions.value[userId] || 0;
    const result = await api.user.getAvatar();
    if (result.error) throw new Error("头像加载失败，请重试");
    if ((revisions.value[userId] || 0) === revision) {
      images.value[userId] = result.data.item.image;
    }
  }

  async function saveAvatar(value: string) {
    if (!userId) throw new Error("请重新登录");
    revisions.value[userId] = (revisions.value[userId] || 0) + 1;
    const result = await api.user.setAvatar(value);
    if (result.error) throw new Error("头像保存失败，请重试");
    images.value[userId] = result.data.item.image;
  }

  function clearAvatarCache() {
    images.value = {};
  }

  return { image, refreshAvatar, saveAvatar, clearAvatarCache };
}
