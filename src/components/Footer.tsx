const REPO = 'https://github.com/dexbob/git2ppt';
const YEAR = new Date().getFullYear();

const NAV = [
  { label: 'Repository', href: REPO },
  { label: 'Issues', href: `${REPO}/issues` },
  { label: 'README', href: `${REPO}#readme` },
  { label: 'Docs', href: `${REPO}/blob/main/README.md` },
] as const;

/** Same horizontal bounds as the input / primary body column on HomePage */
export const FOOTER_SHELL = 'mx-auto w-full max-w-3xl';

export function Footer() {
  return (
    <footer className={`${FOOTER_SHELL} mt-auto pt-10`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <img
            src="/brand/dexter-lab-mark.svg"
            alt=""
            aria-hidden
            className="h-4 w-4 shrink-0 opacity-90"
            width={16}
            height={16}
          />
          <span>
            © {YEAR} <span className="text-slate-400">Dexter Lab.</span>
          </span>
        </p>

        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            {NAV.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-300 hover:underline"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
