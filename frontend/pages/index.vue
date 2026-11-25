<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { toast } from "@/components/ui/sonner";
  import MdiGithub from "~icons/mdi/github";
  import MdiDiscord from "~icons/mdi/discord";
  import MdiFolder from "~icons/mdi/folder";
  import MdiAccount from "~icons/mdi/account";
  import MdiAccountPlus from "~icons/mdi/account-plus";
  import MdiLogin from "~icons/mdi/login";
  import MdiArrowRight from "~icons/mdi/arrow-right";
  import MdiLock from "~icons/mdi/lock";
  import MdiMastodon from "~icons/mdi/mastodon";
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import LanguageSelector from "~/components/App/LanguageSelector.vue";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import AppLogo from "~/components/App/Logo.vue";
  import FormTextField from "~/components/Form/TextField.vue";
  import FormPassword from "~/components/Form/Password.vue";
  import FormCheckbox from "~/components/Form/Checkbox.vue";
  import PasswordScore from "~/components/global/PasswordScore.vue";
  import { PASSWORD_MIN_LENGTH, PASSWORD_RULES } from "~/lib/passwords";
  import { authErrorKey } from "~/lib/auth-errors";
  import "~/assets/css/device-fonts.css";

  const { t } = useI18n();

  useHead({
    title: "HomeBox | " + t("index.title"),
  });

  definePageMeta({
    layout: "empty",
    middleware: [
      () => {
        const ctx = useAuthContext();
        const route = useRoute();
        if (ctx.isAuthorized()) {
          // Preserve invitation token when redirecting authenticated users
          if (route.query.token) {
            return `/home?token=${encodeURIComponent(route.query.token as string)}`;
          }
          return "/devices";
        } else {
          console.log("Logged out, clearing collectionId preference");
          const prefs = useViewPreferences();
          if (prefs.value.collectionId) {
            prefs.value.collectionId = null;
          }
        }
      },
    ],
  });

  const ctx = useAuthContext();

  const api = usePublicApi();
  // Use ref for OIDC error state management
  const oidcError = ref<string | null>(null);
  const shownErrorMessage = ref(false);

  const { data: status } = useAsyncData(async () => {
    const { data } = await api.status();

    if (data.demo) {
      username.value = "demo@example.com";
      password.value = "demodemo";
    }
    return data;
  });

  whenever(status, status => {
    if (status?.demo) {
      email.value = "demo@example.com";
      loginPassword.value = "demodemo";
    }

    // Auto-redirect to OIDC if autoRedirect is enabled, but not if there's an OIDC initialization error
    if (status?.oidc?.enabled && status?.oidc?.autoRedirect && !oidcError.value && !shownErrorMessage.value) {
      loginWithOIDC();
    }
  });

  const isEvilAccentTheme = useIsThemeInList([
    "bumblebee",
    "corporate",
    "forest",
    "pastel",
    "wireframe",
    "black",
    "dracula",
    "autumn",
    "acid",
  ]);
  const isEvilForegroundTheme = useIsThemeInList(["light", "aqua", "fantasy", "autumn", "night"]);
  const isLofiTheme = useIsThemeInList(["lofi"]);

  const route = useRoute();
  const router = useRouter();

  const username = ref("");
  const email = ref("");
  const password = ref("");
  const canRegister = ref(false);
  const remember = ref(false);
  const formErrorKey = ref("");

  const groupToken = computed<string>({
    get() {
      const params = route.query.token;

      if (typeof params === "string") {
        return params;
      }

      return "";
    },
    set(v) {
      router.push({
        query: {
          token: v,
        },
      });
    },
  });

  async function registerUser() {
    if (loading.value) return;
    loading.value = true;
    formErrorKey.value = "";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.value.trim())) {
      formErrorKey.value = "index.toast.invalid_email";
      loading.value = false;
      return;
    }

    try {
      const result = await api.register({
        name: username.value,
        email: email.value.trim(),
        password: password.value,
        token: groupToken.value,
      });
      if (result.error) {
        formErrorKey.value = authErrorKey("register", result.status);
        return;
      }
      toast.success(t("index.toast.user_registered"));
      registerForm.value = false;
    } catch {
      formErrorKey.value = authErrorKey("register");
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    if (groupToken.value !== "") {
      registerForm.value = true;
    }

    // Handle OIDC error notifications from URL parameters
    const oidcErrorParam = route.query.oidc_error;
    if (typeof oidcErrorParam === "string" && oidcErrorParam.startsWith("oidc_")) {
      // Set the error state to prevent auto-redirect
      oidcError.value = oidcErrorParam;
      shownErrorMessage.value = true;

      const translationKey = `index.toast.${oidcErrorParam}`;
      let errorMessage = t(translationKey);

      // If there are additional details, append them
      const details = route.query.details;
      if (typeof details === "string" && details.trim() !== "") {
        errorMessage += `: ${details}`;
      }

      toast.error(errorMessage);

      // Clean up the URL by removing the error parameters
      const newQuery = { ...route.query };
      delete newQuery.oidc_error;
      delete newQuery.details;
      router.replace({ query: newQuery });

      // Clear the error state after showing the message
      oidcError.value = null;
    }
  });

  const loading = ref(false);
  const loginPassword = ref("");
  const redirectTo = useState("authRedirect");

  async function login() {
    if (loading.value) return;
    loading.value = true;
    formErrorKey.value = "";
    try {
      const result = await ctx.login(api, email.value.trim(), loginPassword.value, remember.value);
      if (result.error) {
        formErrorKey.value = authErrorKey("login", result.status);
        return;
      }
      toast.success(t("index.toast.login_success"));
      navigateTo(redirectTo.value || "/devices");
      redirectTo.value = null;
    } catch {
      formErrorKey.value = authErrorKey("login");
    } finally {
      loading.value = false;
    }
  }

  function loginWithOIDC() {
    window.location.href = "/api/v1/users/login/oidc";
  }

  const [registerForm, toggleLogin] = useToggle();
  watch([email, username, password, loginPassword, registerForm], () => { formErrorKey.value = ""; });
</script>

<template>
  <div class="homebox-login relative flex min-h-screen flex-col">
    <div class="relative z-10">
      <header
        class="mx-auto p-4 sm:flex sm:items-end sm:p-6 lg:p-14"
        :class="{
          'text-accent': !isEvilAccentTheme,
          'text-white': isLofiTheme,
        }"
      >
        <div class="z-10">
          <h2 class="mt-1 flex text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            HomeB
            <AppLogo class="-mb-4 w-12" />
            x
          </h2>
          <p
            class="ml-1 text-lg"
            :class="{
              'text-foreground': !isEvilForegroundTheme,
              'text-white': isLofiTheme,
            }"
          >
            {{ $t("index.tagline") }}
          </p>
        </div>
        <TooltipProvider :delay-duration="0">
          <div class="z-10 ml-auto mt-6 flex items-center gap-4 sm:mt-0">
            <Tooltip>
              <TooltipTrigger as-child>
                <a href="https://github.com/sysadminsmedia/homebox" target="_blank" rel="noopener noreferrer">
                  <MdiGithub class="size-8" />
                </a>
              </TooltipTrigger>
              <TooltipContent>{{ $t("global.github") }}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <a href="https://noc.social/@sysadminszone" target="_blank" rel="noopener noreferrer">
                  <MdiMastodon class="size-8" />
                </a>
              </TooltipTrigger>
              <TooltipContent>{{ $t("global.follow_dev") }}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <a href="https://discord.gg/aY4DCkpNA9" target="_blank" rel="noopener noreferrer">
                  <MdiDiscord class="size-8" />
                </a>
              </TooltipTrigger>
              <TooltipContent>{{ $t("global.join_discord") }}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <a href="https://homebox.software/en/" target="_blank" rel="noopener noreferrer">
                  <MdiFolder class="size-8" />
                </a>
              </TooltipTrigger>
              <TooltipContent>{{ $t("global.read_docs") }}</TooltipContent>
            </Tooltip>

            <LanguageSelector class="z-10 text-primary" :expanded="false" />
          </div>
        </TooltipProvider>
      </header>
      <div class="grid min-h-[50vh] p-6 sm:place-items-center">
        <div>
          <Transition name="slide-fade" mode="out-in">
            <form v-if="registerForm" id="register-form" name="register" method="post" @submit.prevent="registerUser">
              <Card class="md:w-[500px]">
                <CardHeader>
                  <CardTitle class="flex items-center gap-2">
                    <MdiAccount class="mr-1 size-7" />
                    {{ $t("index.register") }}
                  </CardTitle>
                </CardHeader>
                <CardContent class="flex flex-col gap-2">
                  <FormTextField
                    id="register-email"
                    v-model="email"
                    :label="$t('index.set_email')"
                    type="email"
                    name="email"
                    autocomplete="username"
                    :required="true"
                    data-testid="email-input"
                  />
                  <FormTextField
                    id="register-name"
                    v-model="username"
                    :label="$t('index.set_name')"
                    name="name"
                    autocomplete="name"
                    :required="true"
                    data-testid="name-input"
                  />
                  <div v-if="!(groupToken == '')" class="pb-1 pt-4 text-center">
                    <p>{{ $t("index.joining_group") }}</p>
                    <button type="button" class="text-xs underline" @click="groupToken = ''">
                      {{ $t("index.dont_join_group") }}
                    </button>
                  </div>
                  <FormPassword
                    id="register-password"
                    v-model="password"
                    :label="$t('index.set_password')"
                    name="new-password"
                    autocomplete="new-password"
                    :min-length="PASSWORD_MIN_LENGTH"
                    :passwordrules="PASSWORD_RULES"
                    :required="true"
                    data-testid="password-input"
                  />
                  <PasswordScore v-model:valid="canRegister" :password="password" />
                  <p v-if="formErrorKey" class="auth-form-error" role="alert">{{ $t(formErrorKey) }}</p>
                </CardContent>
                <CardFooter>
                  <Button
                    data-testid="confirm-register-button"
                    class="w-full"
                    type="submit"
                    :class="loading ? 'loading' : ''"
                    :disabled="loading || !canRegister"
                  >
                    {{ $t("index.register") }}
                  </Button>
                </CardFooter>
              </Card>
            </form>
            <form v-else id="login-form" name="login" method="post" @submit.prevent="login">
              <Card class="md:w-[500px]">
                <CardHeader>
                  <CardTitle class="flex items-center gap-2">
                    <MdiAccount class="mr-1 size-7" />
                    {{ $t("index.login") }}
                  </CardTitle>
                </CardHeader>
                <CardContent v-if="status?.oidc?.allowLocal !== false" class="flex flex-col gap-2">
                  <template v-if="status && status.demo">
                    <p class="text-center text-xs italic">
                      {{ $t("global.demo_instance") }}
                    </p>
                    <p class="text-center text-xs">
                      <b>{{ $t("global.email") }}</b> demo@example.com
                    </p>
                    <p class="text-center text-xs">
                      <b>{{ $t("global.password") }}</b> demodemo
                    </p>
                  </template>
                  <FormTextField
                    id="login-username"
                    v-model="email"
                    :label="$t('global.email')"
                    name="username"
                    autocomplete="username"
                    :required="true"
                  />
                  <FormPassword
                    id="login-password"
                    v-model="loginPassword"
                    :label="$t('global.password')"
                    name="password"
                    autocomplete="current-password"
                    :required="true"
                  />
                  <div class="flex items-center justify-between">
                    <div class="max-w-[140px]">
                      <FormCheckbox v-model="remember" :label="$t('index.remember_me')" />
                    </div>
                    <NuxtLink to="/forgot-password" class="text-sm hover:underline">
                      {{ $t("index.forgot_password") }}
                    </NuxtLink>
                  </div>
                </CardContent>
                <CardFooter class="flex flex-col gap-2">
                  <p v-if="formErrorKey" class="auth-form-error" role="alert">{{ $t(formErrorKey) }}</p>
                  <Button
                    v-if="status?.oidc?.allowLocal !== false"
                    class="w-full"
                    type="submit"
                    :class="loading ? 'loading' : ''"
                    :disabled="loading"
                  >
                    {{ $t("index.login") }}
                  </Button>

                  <div
                    v-if="status?.oidc?.enabled && status?.oidc?.allowLocal !== false"
                    class="flex w-full items-center gap-2"
                  >
                    <hr class="flex-1" />
                    <span class="text-xs text-muted-foreground">{{ $t("index.or") }}</span>
                    <hr class="flex-1" />
                  </div>

                  <Button
                    v-if="status?.oidc?.enabled"
                    type="button"
                    variant="outline"
                    class="w-full"
                    @click="loginWithOIDC"
                  >
                    {{ status.oidc.buttonText || "Sign in with OIDC" }}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Transition>
          <div class="mt-6 text-center">
            <Button
              v-if="status && status.allowRegistration && status?.oidc?.allowLocal !== false"
              class="group"
              variant="link"
              data-testid="register-button"
              @click="() => toggleLogin()"
            >
              <div class="relative mx-2">
                <div
                  class="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:rotate-[360deg]"
                >
                  <MdiAccountPlus v-if="!registerForm" class="size-5 group-hover:hidden" />
                  <MdiLogin v-else class="size-5 group-hover:hidden" />
                  <MdiArrowRight class="hidden size-5 group-hover:block" />
                </div>
              </div>
              {{ registerForm ? $t("index.login") : $t("index.register") }}
            </Button>
            <p v-else class="inline-flex items-center gap-2 text-sm italic">
              <MdiLock class="inline-block size-4" />
              {{ $t("index.disabled_registration") }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <footer v-if="status" class="bottom-0 mt-auto w-full pb-4 text-center">
      <p class="text-center text-sm">
        {{ $t("global.version", { version: status.build.version }) }} ~
        {{ $t("global.build", { build: status.build.commit }) }}
      </p>
    </footer>
  </div>
</template>

<style lang="css" scoped>
  .homebox-login {
    --background: 48 33% 97%;
    --foreground: 40 7% 17%;
    --primary: 14 56% 44%;
    --primary-foreground: 0 0% 100%;
    --accent: 22 62% 94%;
    --accent-foreground: 14 56% 38%;
    --border: 50 20% 89%;
    --input: 45 17% 83%;
    --ring: 201 21% 50%;
    --card: 0 0% 100%;
    --card-foreground: 40 7% 17%;
    background: #faf9f5;
    color: #2f2d29;
    font-family: "Homebox WenKai", "Homebox Sans", "Microsoft YaHei", sans-serif;
    font-synthesis: none;
    color-scheme: light;
    letter-spacing: 0;
  }
  .homebox-login header { color: #ad4e31; padding-top: 36px; padding-bottom: 28px; }
  .homebox-login header h2 { font-family: "Homebox Fraunces", Georgia, serif; font-variation-settings: "SOFT" 75, "WONK" 1; font-size: 36px; font-weight: 500; letter-spacing: 0; }
  .homebox-login header h2 :deep(svg) { width: 32px; margin-bottom: 0; }
  .homebox-login header p { color: #77736b; font-size: 13px; margin-top: 8px; }
  .homebox-login form > :deep(div) { box-shadow: 0 3px 8px #302b2107, 0 18px 50px #302b210a; border-radius: 28px; }
  .homebox-login :deep(input) { background: #fdfcf9; border-radius: 14px; }
  .homebox-login :deep(.password-toggle) { border-radius: 50%; }
  .homebox-login :deep(input[type="email"]),
  .homebox-login :deep(input[name="username"]),
  .homebox-login :deep(input[type="password"]) {
    font-family: "Homebox Manrope", "Homebox WenKai", "Homebox Sans", sans-serif;
  }
  .homebox-login :deep(button[type="submit"]) { border-radius: 999px; box-shadow: inset 0 1px 0 #ffffff33, 0 2px 5px #ad4e3126; }
  .homebox-login footer { color: #77736b; }
  .auth-form-error {
    width: 100%;
    margin: 8px 0 0;
    padding: 10px 12px;
    border-left: 3px solid #ad4e31;
    border-radius: 12px;
    background: #d9775710;
    color: #8b3926;
    font-size: 13px;
    line-height: 1.65;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .slide-fade-enter-active {
    transition: opacity 180ms, transform 180ms cubic-bezier(.22, 1, .36, 1);
  }
  .slide-fade-leave-active { transition: opacity 100ms; }

  .slide-fade-enter-from,
  .slide-fade-leave-to {
    transform: translateY(6px);
    opacity: 0;
  }

  progress[value]::-webkit-progress-value {
    transition: width 0.5s;
  }
  @media (prefers-reduced-motion: reduce) {
    .homebox-login :deep(*) { transition: none !important; animation: none !important; }
  }
</style>
