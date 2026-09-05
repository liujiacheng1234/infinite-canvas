import Link from 'next/link';
import { ArrowUpRight, BookOpen, Rocket } from 'lucide-react';
import { appNames, gitConfig } from '@/lib/shared';
import { localizePath, type Locale } from '@/lib/i18n';
import type { Metadata } from 'next';

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
const starHistoryUrl = `https://www.star-history.com/?repos=${gitConfig.user}%2F${gitConfig.repo}&type=date`;
const starHistoryChart = `https://api.star-history.com/chart?repos=${gitConfig.user}/${gitConfig.repo}&type=date&transparent=true`;
const darkStarHistoryChart = `${starHistoryChart}&theme=dark`;

const messages = {
  en: {
    eyebrow: 'Open-source AI image creation workspace',
    center: 'Documentation',
    description: 'An infinite canvas for image creation that brings canvas composition, AI generation, reference editing, prompt libraries, and reusable assets into one workflow.',
    quickStart: 'Quick Start',
    features: 'Explore Features',
    contributors: 'Contributors',
    contributorsDescription: 'Thank you to everyone who has contributed to this project',
    contributorsAlt: 'Contributor avatars',
  },
  'zh-CN': {
    eyebrow: '开源 AI 图片创作工作台',
    center: '文档中心',
    description: '面向图片创作的无限画布，把画布编排、AI 生成、参考图编辑、提示词库和素材沉淀放在同一个工作流里。',
    quickStart: '快速开始',
    features: '功能介绍',
    contributors: '开发贡献者',
    contributorsDescription: '感谢所有为本项目做出贡献的开发者',
    contributorsAlt: '开发贡献者头像',
  },
};

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  const locale = lang as Locale;
  const text = messages[locale];
  const appName = appNames[locale];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-16 pt-8 md:px-10 md:pt-14">
      <section className="border-b border-zinc-200 pb-12 dark:border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <Rocket className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            {text.eyebrow}
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-zinc-950 dark:text-zinc-50 md:text-6xl [font-family:var(--font-display)]">
            {appName}
            <span className="block text-zinc-500 dark:text-zinc-400">{text.center}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 dark:text-zinc-400">
            {text.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={localizePath(locale, '/docs/overview/quick-start')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <BookOpen className="size-4" />
              {text.quickStart}
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
            >
              <img src="/github.svg" alt="" className="size-4" />
              GitHub
            </a>
          </div>
        </div>

      </section>

      <section className="mx-auto mt-16 w-full max-w-4xl text-center">
        <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50 md:text-3xl">
          {text.contributors}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {text.contributorsDescription}
        </p>
        <div className="mt-7 flex justify-center">
          <a
            href={`${githubUrl}/graphs/contributors`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full"
          >
            <img
              src={`https://contrib.rocks/image?repo=${gitConfig.user}/${gitConfig.repo}`}
              alt={text.contributorsAlt}
              loading="lazy"
              decoding="async"
              className="max-w-full"
            />
          </a>
        </div>
      </section>

      <section className="mx-auto mt-16 w-full max-w-5xl text-center">
        <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50 md:text-3xl">
          Star History
        </h2>
        <div className="mt-7 flex justify-center">
          <a
            href={starHistoryUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="block w-full max-w-4xl"
          >
            <picture>
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={darkStarHistoryChart}
              />
              <source
                media="(prefers-color-scheme: light)"
                srcSet={starHistoryChart}
              />
              <img
                src={starHistoryChart}
                alt="Star History Chart"
                loading="lazy"
                decoding="async"
                className="mx-auto w-full"
              />
            </picture>
          </a>
        </div>
      </section>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as Locale;
  const text = messages[locale];

  return {
    title: `${appNames[locale]} ${text.center}`,
    description: text.description,
    alternates: {
      languages: {
        en: '/',
        'zh-CN': '/zh-CN',
      },
    },
  };
}
