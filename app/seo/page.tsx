import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {SeoOperatingSystem} from "@/components/seo-operating-system";

export default function SeoPage(){
  return <>
    <PageHeader eyebrow="SEO / DISCOVERY OS" title="Search, AI & discoverability" description="Core SEO, technical health, GEO/AI search, ecommerce, visual/voice, authority and white-hat governance.">
      <Link className="secondary-button" href="/seo/redirects">Redirect registry</Link>
    </PageHeader>
    <SeoOperatingSystem/>
  </>;
}
