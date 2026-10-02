import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { becomeFoundingMember } from '@/lib/pricing';

export default function CTAFooterSection() {

  const router = useRouter();
  const pathname = usePathname();

  return (
    <section className="marketing-cta-footer-section px-0!" aria-labelledby="marketing-cta-footer-heading">
      <div className="marketing-cta-footer-content">
        <div className="marketing-cta-footer-pill">
          <span>Limited spots</span>
          <p>The founding member window won&apos;t stay open long.</p>
        </div>
        <h2 id="marketing-cta-footer-heading max-w-none! text-[36px]! sm:text-[40px]! md:text-[48px]!">
          70+ team members. $29/mo.
          <br />
          Limited founding spots.
        </h2>
        <p className="marketing-cta-footer-subtitle">
          Every task you&apos;re outsourcing for hundreds or thousands of dollars a month can be done on 3rdShift in 60 seconds,
          starting today.
        </p>
        <Button
          variant="primary"
          onClick={() => becomeFoundingMember(router, pathname)}
          className="w-62.25! h-10! mt-11.5! sm:mt-11! mb-28.5! border-blue-500!"
        >
          Become a Founding Member →
        </Button>
      </div>
    </section>
  );
}
